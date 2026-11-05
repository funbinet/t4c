package discovery

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// CloudEnumerator discovers exposed cloud storage buckets (S3, OSS, Azure Blob, GCS).
type CloudEnumerator struct {
	Client  *http.Client
	Timeout time.Duration
}

// CloudAsset describes a discovered cloud storage bucket or resource.
type CloudAsset struct {
	URL    string
	Type   string // "s3" | "oss" | "azure" | "gcs"
	Bucket string
	Region string
}

// NewCloudEnumerator returns a cloud storage asset enumerator.
func NewCloudEnumerator(client *http.Client) *CloudEnumerator {
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	return &CloudEnumerator{Client: client, Timeout: 30 * time.Second}
}

// EnumerateCloud attempts to discover accessible cloud storage for a given domain/organization.
// It probes common bucket naming patterns across S3, Azure Blob, OSS (Alibaba), and GCS.
func (c *CloudEnumerator) EnumerateCloud(ctx context.Context, domain string) ([]CloudAsset, error) {
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	var assets []CloudAsset
	patterns := buildCloudPatterns(domain)

	// S3 enumeration
	s3Results := c.probeS3(ctx, patterns)
	assets = append(assets, s3Results...)

	// Azure Blob enumeration
	azureResults := c.probeAzure(ctx, patterns)
	assets = append(assets, azureResults...)

	// Alibaba OSS enumeration
	ossResults := c.probeOSS(ctx, patterns)
	assets = append(assets, ossResults...)

	// GCS enumeration
	gcsResults := c.probeGCS(ctx, patterns)
	assets = append(assets, gcsResults...)

	return assets, nil
}

// buildCloudPatterns generates candidate bucket names from a domain/organization name.
func buildCloudPatterns(domain string) []string {
	base := strings.ToLower(strings.TrimPrefix(domain, "www."))
	base = strings.Split(base, ".")[0]
	base = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		return '-'
	}, base)
	base = strings.Trim(base, "-")
	return []string{
		base,
		base + "-dev",
		base + "-staging",
		base + "-prod",
		base + "-production",
		base + "-data",
		base + "-assets",
		base + "-backup",
		"www-" + base,
		"prod-" + base,
		"dev-" + base,
	}
}

func (c *CloudEnumerator) probeS3(ctx context.Context, patterns []string) []CloudAsset {
	var results []CloudAsset
	regions := []string{"us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"}
	for _, pattern := range patterns {
		for _, region := range regions {
			url := fmt.Sprintf("https://%s.s3.%s.amazonaws.com", pattern, region)
			req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
			resp, err := c.Client.Do(req)
			if err != nil {
				continue
			}
			resp.Body.Close()
			// 200 = bucket exists and is accessible, 307 = exists but redirects, 403 = exists but denied
			if resp.StatusCode == 200 || resp.StatusCode == 307 || resp.StatusCode == 403 {
				results = append(results, CloudAsset{
					URL: url, Type: "s3", Bucket: pattern, Region: region,
				})
				break // found in this region
			}
		}
	}
	return results
}

func (c *CloudEnumerator) probeAzure(ctx context.Context, patterns []string) []CloudAsset {
	var results []CloudAsset
	for _, pattern := range patterns {
		account := pattern
		url := fmt.Sprintf("https://%s.blob.core.windows.net/?comp=list", account)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
		resp, err := c.Client.Do(req)
		if err != nil {
			continue
		}
		resp.Body.Close()
		// 200 = accessible, 404 = not found, 403 = exists but no permission
		if resp.StatusCode == 200 || resp.StatusCode == 403 {
			results = append(results, CloudAsset{
				URL: fmt.Sprintf("https://%s.blob.core.windows.net/", account), Type: "azure", Bucket: account,
			})
		}
	}
	return results
}

func (c *CloudEnumerator) probeOSS(ctx context.Context, patterns []string) []CloudAsset {
	var results []CloudAsset
	regions := []string{"oss-cn-hangzhou", "oss-cn-shanghai", "oss-us-west-1"}
	for _, pattern := range patterns {
		for _, region := range regions {
			url := fmt.Sprintf("https://%s.%s.aliyuncs.com", pattern, region)
			req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
			resp, err := c.Client.Do(req)
			if err != nil {
				continue
			}
			resp.Body.Close()
			if resp.StatusCode == 200 || resp.StatusCode == 403 {
				results = append(results, CloudAsset{
					URL: url, Type: "oss", Bucket: pattern, Region: region,
				})
				break
			}
		}
	}
	return results
}

func (c *CloudEnumerator) probeGCS(ctx context.Context, patterns []string) []CloudAsset {
	var results []CloudAsset
	for _, pattern := range patterns {
		url := fmt.Sprintf("https://storage.googleapis.com/%s", pattern)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; t4c-recon/1.0)")
		resp, err := c.Client.Do(req)
		if err != nil {
			continue
		}
		resp.Body.Close()
		if resp.StatusCode == 200 || resp.StatusCode == 403 {
			results = append(results, CloudAsset{
				URL: url, Type: "gcs", Bucket: pattern,
			})
		}
	}
	return results
}
