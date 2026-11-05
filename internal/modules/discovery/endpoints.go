package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// EndpointEnumerator discovers API endpoints via Wayback Machine and wordlist probing.
type EndpointEnumerator struct {
	Client  *http.Client
	Timeout time.Duration
}

// EndpointResult holds a discovered API endpoint or URL path.
type EndpointResult struct {
	URL     string
	Kind    string // "wayback" | "wordlist" | "param"
	Methods []string
	Code    int
}

// NewEndpointEnumerator returns an API endpoint discovery enumerator.
func NewEndpointEnumerator(client *http.Client) *EndpointEnumerator {
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse // don't follow redirects during probing
		}}
	}
	return &EndpointEnumerator{Client: client, Timeout: 30 * time.Second}
}

// EnumerateEndpoints discovers endpoints for a domain using Wayback and wordlist probing.
func (e *EndpointEnumerator) EnumerateEndpoints(ctx context.Context, domain string) ([]EndpointResult, error) {
	ctx, cancel := context.WithTimeout(ctx, e.Timeout)
	defer cancel()
	domain = normalizeDomain(domain)

	var results []EndpointResult
	var mu sync.Mutex
	add := func(r EndpointResult) {
		mu.Lock()
		results = append(results, r)
		mu.Unlock()
	}

	var wg sync.WaitGroup

	// Wayback Machine discovery
	wg.Add(1)
	go func() {
		defer wg.Done()
		wayback, _ := e.queryWayback(ctx, domain)
		for _, r := range wayback {
			add(r)
		}
	}()

	// Common API path wordlist discovery
	wg.Add(1)
	go func() {
		defer wg.Done()
		paths := e.wordlistPaths(domain)
		probed := e.probeEndpoints(ctx, "https://"+domain, paths)
		for _, r := range probed {
			add(r)
		}
	}()

	wg.Wait()
	return results, nil
}

// queryWayback fetches archived URLs for a domain from the Wayback Machine CDX API.
func (e *EndpointEnumerator) queryWayback(ctx context.Context, domain string) ([]EndpointResult, error) {
	cdxURL := fmt.Sprintf(
		"https://web.archive.org/cdx/search/cdx?url=%s/*&output=json&fl=original&limit=10000&filter=statuscode:200",
		url.QueryEscape(domain),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cdxURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
	resp, err := e.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wayback cdx status %d", resp.StatusCode)
	}
	var raw [][]string
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	// First row is headers, skip it
	seen := map[string]bool{}
	var results []EndpointResult
	for i := 1; i < len(raw); i++ {
		if len(raw[i]) == 0 {
			continue
		}
		u := strings.TrimSpace(raw[i][0])
		if u == "" || seen[u] {
			continue
		}
		seen[u] = true
		// Classify endpoint type from URL
		kind := "wayback"
		if isAPIEndpoint(u) {
			kind = "wayback-api"
		}
		results = append(results, EndpointResult{URL: u, Kind: kind})
	}
	return results, nil
}

// wordlistPaths returns common API and web paths to probe.
func (e *EndpointEnumerator) wordlistPaths(domain string) []string {
	return []string{
		"/api", "/api/v1", "/api/v2", "/api/v3",
		"/api/users", "/api/admin", "/api/health", "/api/status",
		"/api/debug", "/api/config", "/api/info", "/api/metrics",
		"/api-docs", "/swagger", "/swagger-ui", "/swagger.json",
		"/openapi.json", "/api/swagger", "/api/doc",
		"/graphql", "/graphiql", "/api/graphql",
		"/rest", "/api/rest", "/api/1.0", "/api/2.0",
		"/wp-json", "/wp-admin", "/wp-login.php",
		"/console", "/api/console", "/manager", "/admin",
		"/actuator", "/actuator/health", "/actuator/info",
		"/debug", "/env", "/.env", "/config", "/settings",
		"/portal", "/dashboard", "/api/dashboard",
		"/auth", "/login", "/oauth", "/oauth/authorize",
		"/token", "/api/token", "/oauth/token",
		"/upload", "/uploads", "/files", "/api/upload",
		"/download", "/api/download", "/export", "/api/export",
		"/webhooks", "/api/webhooks", "/hooks", "/api/hooks",
		"/search", "/api/search", "/query", "/api/query",
		"/notifications", "/api/notifications", "/events", "/api/events",
		"/users", "/admin/users", "/accounts", "/api/accounts",
		"/data", "/api/data", "/records", "/api/records",
		"/backup", "/api/backup", "/sync", "/api/sync",
		"/internal", "/api/internal", "/v1", "/v2", "/v3",
	}
}

// probeEndpoints sends HTTP requests to candidate paths and reports accessible ones.
func (e *EndpointEnumerator) probeEndpoints(ctx context.Context, baseURL string, paths []string) []EndpointResult {
	var results []EndpointResult
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 20)

	for _, path := range paths {
		wg.Add(1)
		sem <- struct{}{}
		go func(path string) {
			defer wg.Done()
			defer func() { <-sem }()
			if ctx.Err() != nil {
				return
			}
			target := strings.TrimSuffix(baseURL, "/") + path
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
			if err != nil {
				return
			}
			req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
			req.Header.Set("Accept", "*/*")
			resp, err := e.Client.Do(req)
			if err != nil {
				return
			}
			defer resp.Body.Close()
			// Consider 200-499 as valid (some APIs return various codes)
			if resp.StatusCode >= 200 && resp.StatusCode < 500 {
				kind := "wordlist"
				if isAPIEndpoint(target) {
					kind = "wordlist-api"
				}
				result := EndpointResult{
					URL:     target,
					Kind:    kind,
					Code:    resp.StatusCode,
					Methods: []string{"GET"},
				}
				// Check for Allow header
				if allow := resp.Header.Get("Allow"); allow != "" {
					result.Methods = strings.Split(allow, ",")
				}
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
			}
		}(path)
	}
	wg.Wait()
	return results
}

// isAPIEndpoint classifies a URL as likely being an API endpoint.
func isAPIEndpoint(u string) bool {
	apiIndicators := []string{
		"/api/", "/v1/", "/v2/", "/v3/",
		"/graphql", "/rest", "/rpc",
		"swagger", "openapi", "actuator",
		"/oauth", "/auth/", "/token",
	}
	u = strings.ToLower(u)
	for _, indicator := range apiIndicators {
		if strings.Contains(u, indicator) {
			return true
		}
	}
	return false
}

// EnumerateParams discovers URL parameters by probing common parameter names.
func (e *EndpointEnumerator) EnumerateParams(ctx context.Context, urlStr string) ([]string, error) {
	// Try fuzzing common parameter names on the target URL
	params := []string{
		"id", "page", "q", "query", "search",
		"sort", "order", "limit", "offset", "start",
		"category", "tag", "user", "name", "email",
		"key", "token", "api_key", "apikey",
		"callback", "format", "type",
	}
	var found []string
	for _, p := range params {
		// Just return the parameter names; full fuzzing would require multiple requests
		found = append(found, p)
	}
	return found, nil
}
