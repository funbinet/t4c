package discovery

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/miekg/dns"
)

// DNSZoneResolver performs DNS zone enumeration via AXFR attempts and
// next-name probing when transfers are refused.
type DNSZoneResolver struct {
	Timeout time.Duration
}

// NewDNSZoneResolver returns a DNS zone enumeration resolver.
func NewDNSZoneResolver() *DNSZoneResolver {
	return &DNSZoneResolver{Timeout: 60 * time.Second}
}

// ZoneRecords holds the result of a zone transfer or name probing.
type ZoneRecords struct {
	Records  []DomainResult
	Complete bool // true if a full AXFR succeeded
	Source   string
}

// EnumerateZone attempts AXFR against the authoritative nameservers of a
// domain, falling back to next-name probing. Gracefully degrades to an empty
// result when every nameserver refuses transfers.
func (z *DNSZoneResolver) EnumerateZone(ctx context.Context, domain string, base Resolver) (ZoneRecords, error) {
	ctx, cancel := context.WithTimeout(ctx, z.Timeout)
	defer cancel()
	domain = normalizeDomain(domain)

	res, err := base.Resolve(ctx, domain)
	if err != nil {
		return ZoneRecords{}, err
	}

	// Collect authoritative nameservers from the resolver output. DNSX reports
	// NS answers through the record list when the question type includes NS.
	var nsServers []string
	for _, rec := range res.Records {
		rec = strings.TrimSpace(rec)
		if rec == "" {
			continue
		}
		lower := strings.ToLower(rec)
		if strings.HasPrefix(lower, "ns:") {
			ns := strings.TrimSpace(strings.TrimPrefix(rec, "NS:"))
			ns = strings.TrimSuffix(ns, ".")
			if ns != "" {
				nsServers = append(nsServers, ns)
			}
		}
	}
	// Probe the conventional nameserver names as well.
	for _, ns := range []string{"ns1." + domain, "ns2." + domain, "dns." + domain} {
		if r, err := base.Resolve(ctx, ns); err == nil && len(r.IPs) > 0 {
			nsServers = append(nsServers, ns)
		}
	}

	var out ZoneRecords
	seen := map[string]bool{}
	addRecords := func(records []DomainResult, source string, complete bool) {
		for _, r := range records {
			if r.Domain == "" || seen[r.Domain] {
				continue
			}
			seen[r.Domain] = true
			out.Records = append(out.Records, r)
		}
		if complete {
			out.Complete = true
			out.Source = source
		}
	}

	// Attempt a zone transfer from every authoritative server.
	for _, ns := range nsServers {
		records, err := z.axfrFromServer(ctx, ns, domain)
		if err == nil && len(records) > 0 {
			addRecords(records, "axfr:"+ns, true)
			return out, nil
		}
	}

	// AXFR refused everywhere — fall back to next-name probing.
	out.Records = append(out.Records, z.probeNames(ctx, domain, base)...)
	out.Source = "dns-probe"
	return out, nil
}

// axfrFromServer performs a TCP DNS AXFR transfer against one nameserver.
func (z *DNSZoneResolver) axfrFromServer(ctx context.Context, server, domain string) ([]DomainResult, error) {
	ip := server
	if !netParseIP(server) {
		resolved, err := z.lookupA(ctx, server)
		if err != nil {
			return nil, err
		}
		ip = resolved
	}

	transfer := new(dns.Transfer)
	transfer.DialTimeout = 10 * time.Second
	transfer.ReadTimeout = 30 * time.Second
	msg := new(dns.Msg)
	msg.SetAxfr(dns.Fqdn(domain))
	envelope, err := transfer.In(msg, netJoinHostPort(ip))
	if err != nil {
		return nil, err
	}
	var results []DomainResult
	seen := map[string]bool{}
	for env := range envelope {
		if env.Error != nil {
			continue
		}
		for _, rrMsg := range env.RR {
			if rrMsg == nil {
				continue
			}
			switch rrMsg.Header().Rrtype {
			case dns.TypeA, dns.TypeAAAA, dns.TypeCNAME, dns.TypeMX, dns.TypeNS, dns.TypeTXT:
			default:
				continue
			}
			host := strings.TrimSuffix(rrMsg.Header().Name, ".")
			if host == "" || !strings.HasSuffix(host, "."+domain) {
				continue
			}
			if seen[host] {
				continue
			}
			seen[host] = true
			results = append(results, DomainResult{Domain: host, Source: "axfr"})
		}
	}
	return results, nil
}

// lookupA resolves a hostname to its first A record via a public resolver.
func (z *DNSZoneResolver) lookupA(ctx context.Context, host string) (string, error) {
	client := &dns.Client{Net: "udp", Timeout: 5 * time.Second}
	msg := new(dns.Msg)
	msg.SetQuestion(dns.Fqdn(host), dns.TypeA)
	in, _, err := client.ExchangeContext(ctx, msg, "8.8.8.8:53")
	if err != nil {
		return "", err
	}
	for _, answer := range in.Answer {
		if a, ok := answer.(*dns.A); ok {
			return a.A.String(), nil
		}
	}
	return "", fmt.Errorf("no A record for %s", host)
}

// probeNames asks the resolver for conventional hostnames. It is the graceful
// fallback when zone transfers are refused.
func (z *DNSZoneResolver) probeNames(ctx context.Context, domain string, base Resolver) []DomainResult {
	prefixes := []string{
		"admin", "api", "blog", "cdn", "cloud", "demo", "dev", "docs",
		"ftp", "git", "imap", "ipv6", "jira", "mail", "mx", "mx1", "mx2",
		"ns", "ns1", "ns2", "pop", "smtp", "ssh", "staging", "status",
		"test", "vpn", "www",
	}
	var results []DomainResult
	seen := map[string]bool{}
	for _, prefix := range prefixes {
		if ctx.Err() != nil {
			break
		}
		host := prefix + "." + domain
		if r, err := base.Resolve(ctx, host); err == nil && r.Domain != "" && !seen[r.Domain] {
			seen[r.Domain] = true
			r.Source = "dns-probe"
			results = append(results, r)
		}
	}
	return results
}

// CheckAXFRAvailable reports whether a nameserver answers AXFR requests at all.
func (z *DNSZoneResolver) CheckAXFRAvailable(ctx context.Context, server string) bool {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	records, err := z.axfrFromServer(ctx, server, "example.com")
	return err == nil && len(records) >= 0
}

func netParseIP(s string) bool {
	return strings.Contains(s, ":") || isDottedQuad(s)
}

func isDottedQuad(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 4 {
		return false
	}
	for _, p := range parts {
		if p == "" || len(p) > 3 {
			return false
		}
		for _, r := range p {
			if r < '0' || r > '9' {
				return false
			}
		}
	}
	return true
}

func netJoinHostPort(host string) string {
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		return "[" + host + "]:53"
	}
	return host + ":53"
}
