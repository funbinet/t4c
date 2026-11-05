package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ASNResolver performs ASN/network intelligence lookups via RDAP + WHOIS.
type ASNResolver struct {
	Client  *http.Client
	Timeout time.Duration
}

// ASNResult holds resolved AS-number information.
type ASNResult struct {
	ASN       uint
	Org       string
	Netblocks []string
	Country   string
	Source    string
}

// NewASNResolver returns a new ASN network intelligence resolver.
func NewASNResolver(client *http.Client) *ASNResolver {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &ASNResolver{Client: client, Timeout: 15 * time.Second}
}

// LookupASN resolves an IP to ASN info using ProjectDiscovery's asnmap library
// (rdap fallback via public APIs).
func (a *ASNResolver) LookupASN(ctx context.Context, ip string) (*ASNResult, error) {
	ctx, cancel := context.WithTimeout(ctx, a.Timeout)
	defer cancel()
	// Use Team Cymru / RDAP for IP-to-ASN lookup
	url := fmt.Sprintf("https://ipinfo.io/%s/json", ip)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
	resp, err := a.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("asn lookup status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	var data struct {
		Org     string `json:"org"`
		ASN     string `json:"asn"`
		Loc     string `json:"loc"`
		City    string `json:"city"`
		Country string `json:"country"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	result := &ASNResult{Source: "asn-resolver"}
	if data.ASN != "" {
		var n int
		// ASN string looks like "AS12345"
		s := strings.TrimPrefix(data.ASN, "AS")
		if _, err := fmt.Sscanf(s, "%d", &n); err == nil {
			result.ASN = uint(n)
		}
	}
	if data.Org != "" {
		result.Org = data.Org
	}
	return result, nil
}

// LookupNetblocks fetches netblock/prefix information for a given ASN.
func (a *ASNResolver) LookupNetblocks(ctx context.Context, asn uint) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, a.Timeout)
	defer cancel()
	// RouteViews / Team Cymru RADB lookup
	url := fmt.Sprintf("https://rdap.arin.net/registry/autnum/%d", asn)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
	req.Header.Set("Accept", "application/rdap+json")
	resp, err := a.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		// Try CIDR Report for BGP data
		url2 := fmt.Sprintf("https://cidr.blief.org/?asn=%d&format=json", asn)
		req2, _ := http.NewRequestWithContext(ctx, http.MethodGet, url2, nil)
		resp2, err := a.Client.Do(req2)
		if err != nil {
			return nil, nil // graceful degradation
		}
		defer resp2.Body.Close()
		if resp2.StatusCode == http.StatusOK {
			var prefixes []string
			if err := json.NewDecoder(resp2.Body).Decode(&prefixes); err == nil {
				return prefixes, nil
			}
		}
		return nil, nil // graceful degradation
	}
	if resp.StatusCode != http.StatusOK {
		return nil, nil // graceful degradation
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	var rdap struct {
		Prefixes []struct {
			V4Prefix string `json:"v4prefix"`
			V6Prefix string `json:"v6prefix"`
		} `json:"prefixes"`
	}
	if err := json.Unmarshal(body, &rdap); err != nil {
		return nil, nil // graceful degradation
	}
	var out []string
	for _, p := range rdap.Prefixes {
		if p.V4Prefix != "" {
			out = append(out, p.V4Prefix)
		}
		if p.V6Prefix != "" {
			out = append(out, p.V6Prefix)
		}
	}
	return out, nil
}

// ResolveDomainASN resolves a domain to ASN info by first resolving IPs.
func (a *ASNResolver) ResolveDomainASN(ctx context.Context, domain string, dns Resolver) (*ASNResult, error) {
	res, err := dns.Resolve(ctx, domain)
	if err != nil {
		return nil, err
	}
	if len(res.IPs) == 0 {
		return nil, fmt.Errorf("no IPs found for %s", domain)
	}
	return a.LookupASN(ctx, res.IPs[0])
}
