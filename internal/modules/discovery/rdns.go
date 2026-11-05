package discovery

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

// RDNSResolver performs reverse DNS lookups and PTR sweeps over netblocks.
type RDNSResolver struct {
	Timeout time.Duration
}

// NewRDNSResolver returns a reverse DNS PTR sweep resolver.
func NewRDNSResolver() *RDNSResolver {
	return &RDNSResolver{Timeout: 30 * time.Second}
}

// RDNSResult holds a PTR record from a reverse lookup.
type RDNSResult struct {
	IP     string
	PTR    string
	Source string
}

// LookupPTR resolves a single IP to its PTR record.
func (r *RDNSResolver) LookupPTR(ctx context.Context, ip string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, r.Timeout)
	defer cancel()
	names, err := net.LookupAddr(ip)
	if err != nil {
		return "", err
	}
	if len(names) == 0 {
		return "", fmt.Errorf("no PTR record for %s", ip)
	}
	return strings.TrimSuffix(names[0], "."), nil
}

// SweepNetblock performs parallel PTR lookups for all hosts in a CIDR netblock.
// The limit parameter caps the number of IPs scanned to avoid runaway scans.
func (r *RDNSResolver) SweepNetblock(ctx context.Context, netblock string, limit int) ([]RDNSResult, error) {
	if limit <= 0 {
		limit = 256
	}
	if limit > 4096 {
		limit = 4096
	}
	_, ipNet, err := net.ParseCIDR(netblock)
	if err != nil {
		return nil, err
	}
	var results []RDNSResult
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 50)

	it := firstIP(ipNet)
	count := 0
	for ipNet.Contains(it) {
		if count >= limit {
			break
		}
		count++
		wg.Add(1)
		sem <- struct{}{}
		go func(ip net.IP) {
			defer wg.Done()
			defer func() { <-sem }()
			if ctx.Err() != nil {
				return
			}
			ptr, err := r.LookupPTR(ctx, ip.String())
			if err == nil && ptr != "" {
				mu.Lock()
				results = append(results, RDNSResult{IP: ip.String(), PTR: ptr, Source: "rdns-sweep"})
				mu.Unlock()
			}
		}(it)
		it = nextIP(it)
	}
	wg.Wait()
	return results, nil
}

// SweepARPA enumerates PTR records for IPs in multiple netblocks.
// It is used to discover internal hostnames from ASN/RDAP netblock attribution.
func (r *RDNSResolver) SweepARPA(ctx context.Context, netblocks []string, limitPerBlock int) ([]RDNSResult, error) {
	if limitPerBlock <= 0 {
		limitPerBlock = 256
	}
	var results []RDNSResult
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 50)

	for _, nb := range netblocks {
		_, ipNet, err := net.ParseCIDR(nb)
		if err != nil {
			continue
		}
		count := 0
		for ip := firstIP(ipNet); ipNet.Contains(ip); ip = nextIP(ip) {
			if count >= limitPerBlock {
				break
			}
			count++
			wg.Add(1)
			sem <- struct{}{}
			go func(ip net.IP) {
				defer wg.Done()
				defer func() { <-sem }()
				if ctx.Err() != nil {
					return
				}
				ptr, err := r.LookupPTR(ctx, ip.String())
				if err == nil && ptr != "" {
					mu.Lock()
					results = append(results, RDNSResult{IP: ip.String(), PTR: ptr, Source: "rdns-arpa"})
					mu.Unlock()
				}
			}(ip)
		}
	}
	wg.Wait()
	return results, nil
}

// ReverseLookup resolves PTR records for a list of IPs.
func (r *RDNSResolver) ReverseLookup(ctx context.Context, ips []string) ([]RDNSResult, error) {
	var results []RDNSResult
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 50)
	for _, ip := range ips {
		wg.Add(1)
		sem <- struct{}{}
		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()
			if ctx.Err() != nil {
				return
			}
			ptr, err := r.LookupPTR(ctx, ip)
			if err == nil && ptr != "" {
				mu.Lock()
				results = append(results, RDNSResult{IP: ip, PTR: ptr, Source: "rdns"})
				mu.Unlock()
			}
		}(ip)
	}
	wg.Wait()
	return results, nil
}

// nextIP returns the next IP in sequence.
func nextIP(ip net.IP) net.IP {
	out := make(net.IP, len(ip))
	copy(out, ip)
	incrementIP(out)
	return out
}

func incrementIP(ip net.IP) {
	for i := len(ip) - 1; i >= 0; i-- {
		ip[i]++
		if ip[i] > 0 || i == 0 {
			break
		}
	}
}

// firstIP returns the first usable IP in a CIDR range.
func firstIP(p *net.IPNet) net.IP {
	ip := make(net.IP, len(p.IP))
	copy(ip, p.IP)
	ip = ip.To16()
	if ip == nil {
		return p.IP
	}
	if p.IP.To4() != nil {
		// For IPv4, start at the network address + 1
		ip = p.IP.To4()
		out := make(net.IP, 4)
		copy(out, ip)
		out[3]++ // skip network address
		return out
	}
	// For IPv6, start at the base
	return ip
}
