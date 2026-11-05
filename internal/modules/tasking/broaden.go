package tasking

import (
	"context"
	"fmt"
	"strings"

	"github.com/funbinet/t4c/internal/domain"
	"github.com/funbinet/t4c/internal/modules/discovery"
	"github.com/funbinet/t4c/internal/store"
)

// Broadeners bundles the optional recon broadening SDKs. Every adapter
// degrades gracefully: when one is nil the broaden step simply skips it and
// records a warning, so scans never fail because an external source is down.
type Broadeners struct {
	CT        *discovery.CTEnumerator
	ASN       *discovery.ASNResolver
	DNSZone   *discovery.DNSZoneResolver
	Cloud     *discovery.CloudEnumerator
	RDNS      *discovery.RDNSResolver
	Endpoints *discovery.EndpointEnumerator
}

// BroadenEnabled reports whether the broaden step should run for a task.
func BroadenEnabled(opts domain.TaskOptions) bool {
	return opts.Broaden
}

// stepBroaden runs the opt-in broadening SDKs (Certificate Transparency, ASN
// attribution, DNS zone enumeration, cloud bucket discovery, reverse DNS, and
// API endpoint discovery) after the core recon chain. Each SDK is independent:
// failures are recorded as task warnings, never step errors, so a flaky
// external source cannot fail a scan.
func (e *Engine) stepBroaden(ctx context.Context, task *domain.Task, step *domain.TaskStep) error {
	b := e.Broaden
	if b == nil {
		e.recordBroadenWarning(ctx, task, "broaden", "broadening SDKs are not configured")
		return nil
	}
	base := strings.ToLower(strings.TrimSpace(task.Target))
	if base == "" {
		return nil
	}
	total := 0
	progress := func(done, of int) {
		p := 0
		if of > 0 {
			p = done * 100 / of
		}
		_ = e.Store.UpdateStepFields(ctx, step.ID, store.StepPatch{Progress: &p})
	}
	sources := 6

	// 1. Certificate Transparency (crt.sh).
	if b.CT != nil {
		if enum, err := b.CT.EnumerateCT(ctx, base); err == nil {
			count := e.observeBroadenedDomains(ctx, task, enum.Domains)
			total += count
			progress(1, sources)
		} else {
			e.recordBroadenWarning(ctx, task, "ct", fmt.Sprintf("certificate transparency lookup failed: %v", err))
		}
	} else {
		e.recordBroadenWarning(ctx, task, "ct", "certificate transparency SDK not configured")
	}

	// 2. DNS zone enumeration (AXFR / probing).
	if b.DNSZone != nil {
		if zone, err := b.DNSZone.EnumerateZone(ctx, base, e.DNS); err == nil {
			count := e.observeBroadenedDomains(ctx, task, zone.Records)
			total += count
			progress(2, sources)
		} else {
			e.recordBroadenWarning(ctx, task, "dnszone", fmt.Sprintf("zone enumeration failed: %v", err))
		}
	}

	// 3. ASN / netblock attribution for discovered IPs.
	if b.ASN != nil {
		ips, err := e.taskAssetKeys(ctx, task.ID, domain.AssetIP)
		if err == nil && len(ips) > 0 {
			limit := e.hostBudget()
			if len(ips) > limit {
				ips = ips[:limit]
			}
			discovered := 0
			for _, ip := range ips {
				if ctx.Err() != nil {
					break
				}
				result, err := b.ASN.LookupASN(ctx, ip)
				if err != nil || result == nil {
					continue
				}
				data := map[string]any{
					"ip": ip, "source": "asn", "asn": result.ASN, "asnOrg": result.Org,
					"country": result.Country, "netblocks": result.Netblocks,
				}
				if asset, err := e.Store.UpsertAsset(ctx, domain.AssetIP, ip, data, task.ID, task.ScopeID); err == nil {
					_ = e.Store.ObserveAsset(ctx, task.ID, asset, "asn", data)
					e.linkScope(ctx, task, asset)
					discovered++
				}
			}
			total += discovered
		}
		progress(3, sources)
	}

	// 4. Cloud bucket discovery.
	if b.Cloud != nil {
		if assets, err := b.Cloud.EnumerateCloud(ctx, base); err == nil {
			count := 0
			for _, a := range assets {
				if ctx.Err() != nil {
					break
				}
				data := map[string]any{
					"bucket": a.Bucket, "cloudType": a.Type, "url": a.URL,
					"region": a.Region, "source": "cloud",
				}
				if asset, err := e.Store.UpsertAsset(ctx, domain.AssetBucket, a.URL, data, task.ID, task.ScopeID); err == nil {
					_ = e.Store.ObserveAsset(ctx, task.ID, asset, "cloud", data)
					e.linkScope(ctx, task, asset)
					count++
				}
			}
			total += count
		} else {
			e.recordBroadenWarning(ctx, task, "cloud", fmt.Sprintf("cloud discovery failed: %v", err))
		}
	}
	progress(4, sources)

	// 5. Reverse DNS PTR sweep over discovered IPs.
	if b.RDNS != nil {
		ips, err := e.taskAssetKeys(ctx, task.ID, domain.AssetIP)
		if err == nil && len(ips) > 0 {
			limit := e.hostBudget()
			if len(ips) > limit {
				ips = ips[:limit]
			}
			if ptrs, err := b.RDNS.ReverseLookup(ctx, ips); err == nil {
				count := 0
				for _, ptr := range ptrs {
					if ctx.Err() != nil {
						break
					}
					if !strings.HasSuffix(ptr.PTR, "."+base) && ptr.PTR != base {
						continue
					}
					data := map[string]any{
						"domain": ptr.PTR, "ips": []string{ptr.IP}, "source": "rdns",
					}
					if asset, err := e.Store.UpsertAsset(ctx, domain.AssetDomain, ptr.PTR, data, task.ID, task.ScopeID); err == nil {
						_ = e.Store.ObserveAsset(ctx, task.ID, asset, "rdns", data)
						e.linkScope(ctx, task, asset)
						count++
					}
				}
				total += count
			}
		}
	}
	progress(5, sources)

	// 6. API / endpoint discovery (Wayback + wordlist probing).
	if b.Endpoints != nil {
		if endpoints, err := b.Endpoints.EnumerateEndpoints(ctx, base); err == nil {
			count := 0
			for _, ep := range endpoints {
				if ctx.Err() != nil {
					break
				}
				kind := domain.AssetURL
				if strings.Contains(ep.Kind, "api") {
					kind = domain.AssetAPIEndpoint
				}
				data := map[string]any{
					"url": ep.URL, "endpointKind": ep.Kind, "code": ep.Code,
					"methods": ep.Methods, "source": "endpoints",
				}
				if asset, err := e.Store.UpsertAsset(ctx, kind, ep.URL, data, task.ID, task.ScopeID); err == nil {
					_ = e.Store.ObserveAsset(ctx, task.ID, asset, "endpoints", data)
					e.linkScope(ctx, task, asset)
					count++
				}
			}
			total += count
		} else {
			e.recordBroadenWarning(ctx, task, "endpoints", fmt.Sprintf("endpoint discovery failed: %v", err))
		}
	}
	progress(6, sources)

	_ = e.Store.AppendTaskEvent(ctx, &domain.TaskEvent{
		TaskID: task.ID, Type: "step.status",
		Message: fmt.Sprintf("broadening discovered %d additional assets", total),
		Payload: map[string]any{"stepId": step.ID, "kind": step.Kind, "status": "running", "discovered": total},
	})
	return nil
}

// observeBroadenedDomains resolves and persists passive domain results from
// broadening sources, reusing the standard DNS resolution path.
func (e *Engine) observeBroadenedDomains(ctx context.Context, task *domain.Task, domains []discovery.DomainResult) int {
	if len(domains) == 0 {
		return 0
	}
	// De-duplicate against the passive enumeration limit and existing assets.
	limit := e.hostBudget()
	if len(domains) > limit {
		domains = domains[:limit]
	}
	count := 0
	for _, item := range domains {
		if ctx.Err() != nil {
			break
		}
		res, err := e.DNS.Resolve(ctx, item.Domain)
		if err != nil {
			continue
		}
		res.Source = item.Source
		e.observeDomain(ctx, task, res, item.Source)
		count++
	}
	return count
}

func (e *Engine) recordBroadenWarning(ctx context.Context, task *domain.Task, kind, message string) {
	task.Warnings = append(task.Warnings, message)
	if e.Log != nil {
		e.Log.Warn("broaden warning", "taskId", task.ID, "kind", kind, "warning", message)
	}
	if e.Store == nil {
		return
	}
	_ = e.Store.UpdateTaskFields(ctx, task.ID, store.TaskPatch{Warnings: ptr(task.Warnings)})
	_ = e.Store.AppendTaskEvent(ctx, &domain.TaskEvent{
		TaskID: task.ID, Type: "task.warning", Message: message,
		Payload: map[string]any{"kind": kind, "status": "degraded", "source": "broaden"},
	})
}
