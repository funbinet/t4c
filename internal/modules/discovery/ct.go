package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// CTEnumerator discovers subdomains via Certificate Transparency logs (crt.sh).
type CTEnumerator struct {
	Client  *http.Client
	BaseURL string
	Timeout time.Duration
}

// NewCTEnumerator returns a CT-based passive subdomain enumerator using crt.sh.
func NewCTEnumerator(client *http.Client) *CTEnumerator {
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	return &CTEnumerator{
		Client:  client,
		BaseURL: "https://crt.sh",
		Timeout: 30 * time.Second,
	}
}

// EnumerateCT queries Certificate Transparency logs for subdomains of domain.
func (c *CTEnumerator) EnumerateCT(ctx context.Context, domain string) (PassiveEnumeration, error) {
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	domain = normalizeDomain(domain)
	url := fmt.Sprintf("%s/?q=%%25.%s&output=json", c.BaseURL, domain)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return PassiveEnumeration{}, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
	resp, err := c.Client.Do(req)
	if err != nil {
		return PassiveEnumeration{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return PassiveEnumeration{}, fmt.Errorf("crt.sh responded with %d", resp.StatusCode)
	}
	var results []struct {
		NameValue string `json:"name_value"`
		NameType  string `json:"name_type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return PassiveEnumeration{}, err
	}
	seen := map[string]bool{}
	var domains []DomainResult
	for _, r := range results {
		for _, name := range strings.Split(r.NameValue, "\n") {
			name = strings.TrimSpace(name)
			if name == "" || seen[name] {
				continue
			}
			seen[name] = true
			host := strings.ToLower(name)
			host = strings.TrimPrefix(host, "*. ")
			host = strings.TrimPrefix(host, "*.")
			if !strings.HasSuffix(host, "."+domain) && host != domain {
				continue
			}
			domains = append(domains, DomainResult{Domain: host, Source: "crt.sh"})
		}
	}
	return PassiveEnumeration{Domains: domains, Truncated: len(domains) >= 10000}, nil
}

// Enumerate implements PassiveEnumerator so CT can be called by the broaden step.
func (c *CTEnumerator) Enumerate(ctx context.Context, domain string) (PassiveEnumeration, error) {
	return c.EnumerateCT(ctx, domain)
}

var _ PassiveEnumerator = (*CTEnumerator)(nil)
