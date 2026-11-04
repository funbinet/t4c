# T4C Integrations — Status, Setup & Roadmap

What every integration needs, what currently works, what was failing and why, and what to do next. Read this together with `docs/API-INTEGRATION.md` (API keys) and `docs/DEPLOYMENT.md` (Render/Vercel setup).

---

## Status at a glance

| Integration | Purpose | Status | Needs |
| --- | --- | --- | --- |
| GeoIP (DB-IP/GeoLite) | Put IP assets on the map, city/ASN enrichment | ✅ **Fixed** — deploy-time download repaired | None (auto-download) |
| ICP lookup (Chinaz + icpquery) | Reverse-map an organization to its filed root domains | ⚠️ Config needed | `T4C_ICP_CHINAZ_COOKIE` |
| GitHub code search | Leak/secret discovery for org keywords | ⚠️ Config needed | `T4C_GITHUB_TOKEN` |
| FOFA | Extended IP/service enrichment | ⚠️ Optional | `T4C_FOFA_KEY` |
| Neo4j graph | Organization→asset→risk relationship graph | ⚠️ Optional | `T4C_NEO4J_*` |
| Subfinder providers | Passive subdomain enumeration | ⚠️ Optional | `T4C_SUBFINDER_PROVIDER_CONFIG` |
| PostgreSQL + Redis | Storage + queue | ✅ Working (Render + Redis) | Connection env vars |
| Notifications | Scan alerts | ⚠️ Optional | config.yaml block |

---

## 1. GeoIP — FIXED

**Symptom (Render log):** `curl: (6) Could not resolve host: dbip.uu-ml.com` → `GeoIP disabled, error: geoip: unavailable` → the Overview map stayed empty and IP assets showed no location.

**Root cause:** `deploy/render/entrypoint.sh` downloaded the DB-IP lite databases from `dbip.uu-ml.com`, a mirror whose DNS no longer resolves. On failure the entrypoint unset `T4C_GEOIP_CITY`/`T4C_GEOIP_ASN`, so the server booted with GeoIP disabled.

**Fix (shipped):** the entrypoint now downloads from the official `https://download.db-ip.com/free/dbip-{city,asn}-lite-YYYY-MM.mmdb.gz` (gunzipped on arrival) and falls back to the daily `P3TERX/GeoLite.mmdb` GitHub release (`GeoLite2-City.mmdb` / `GeoLite2-ASN.mmdb`). Both URLs were verified reachable at the time of the fix.

**What you must do:** redeploy on Render. On the first boot the fresh disk downloads both databases; the map then plots located IP assets and the Overview `GeoIP` health chip turns green. `T4C_GEOIP_DOWNLOAD=0` disables the download if you pre-place mmdb files on the disk.

## 2. ICP lookup — needs a Chinaz cookie

The ICP integration answers: *"given an organization name, which root domains are registered to it in the ICP filing system?"* It powers the **ICP Lookup** button on the organization screen and seeds the candidate root-domain list.

**Why it reports "unavailable":** the Chinaz ICP scraper is only configured when a valid `icp.chinaz.com` session cookie is supplied. Without it `Chinaz` health is `unavailable` and lookups fail.

**Setup:**
1. Log in to `https://icp.chinaz.com` in a browser.
2. Copy the cookie header value (DevTools → Network → any request → `Cookie:`).
3. On Render set:
   - `T4C_ICP_CHINAZ_COOKIE` — the raw cookie string (no literal quotes).
   - optionally `T4C_ICP_CHINAZ_USER_AGENT` — use the **same** user agent as the browser you copied the cookie from.
4. `T4C_ICP_ICPQUERY_BASE_URL` can override the secondary ICP query endpoint if needed.

Cookies expire periodically — if ICP flips back to `unavailable` after working, refresh the cookie. The workflow it enables: **Add root domain → ICP lookup → confirm ownership → Play (full recon)**.

## 3. GitHub integration — needs a token

GitHub code search finds leaked secrets/credentials for organization keywords (Leak Results / Search Tasks / Monitors tabs).

**Why it's silent without setup:** GitHub code search requires an authenticated token; without `T4C_GITHUB_TOKEN` search tasks fail.

**Setup:** create a classic token with `repo` scope (fine-grained tokens must include code search read permission) at GitHub → Settings → Developer settings, then set `T4C_GITHUB_TOKEN` on Render. Optional: `T4C_GITHUB_API_URL` for GitHub Enterprise.

## 4. FOFA (optional)

Extended asset enrichment from the FOFA internet-db. Set `T4C_FOFA_URL` (default `https://fofa.info`) and `T4C_FOFA_KEY` (your FOFA API key). Without a key the feature stays dormant; everything else works.

## 5. Neo4j graph (optional)

The relationship graph on Overview (select an org → graph view) is served from Neo4j. Without it the map still works; the graph tab shows "Graph unavailable". Set `T4C_NEO4J_URI`, `T4C_NEO4J_USER`, `T4C_NEO4J_PASSWORD`, `T4C_NEO4J_DATABASE`. A free Neo4j AuraDB instance is sufficient; enable `T4C_NEO4J_ALLOW_REBUILD=1` to let T4C rebuild graph data.

## 6. Subfinder provider config (optional)

Passive subdomain discovery quality depends on provider API keys (SecurityTrails, Censys, Shodan, …). Mount or point to a provider config file via `T4C_SUBFINDER_PROVIDER_CONFIG`. Without it subfinder still uses free sources but finds fewer subdomains.

## 7. Notifications (optional)

Scan completion/finding alerts are configured in `config.yaml` (`notifications.dingTalk`, `feishu`, `wecom`, `smtp`, `webhook`). These currently have **no environment-variable overrides** — they must be set in the config file (or a config mounted on the Render disk).

---

## Full recon from an organization — how it works now

1. **Organizations** screen → click a row → organization workspace.
2. **Add Root Domain** (+) → enter candidate domains.
3. **ICP Lookup** (search icon) → reverse-locates filed domains and ownership evidence (needs the Chinaz cookie, §2).
4. **Root Domains tab** → confirm candidate ownership (checkbox → Confirm).
5. **Play button** → always clickable; opens the scan dialog listing confirmed root domains (up to 10 per batch). If nothing is confirmed, the dialog walks you through steps 2–4 instead of being a dead button.
6. `POST /organizations/{id}/scans` submits one EASM task per confirmed domain, each tagged with `organizationId` and `origin=easm`, using the selected scan policy (DNS brute → port scan → service/site detection → WIH → nuclei, per policy).
7. Results land in the org tabs: **Assets** (domain/IP/service), **Risks**, **Tasks** (scan history), and the **Overview** tab (surface summary, risk breakdown, recent assets, current risks, scan history). Everything is exported via the **Export** button (XLSX/CSV).

Tasks are organization-scoped: EASM scans are always linked; standalone tasks created via `POST /tasks` now accept an `organizationId` field (validated against the org store) so manual tasks also roll up into the organization view. The Tasks screen's *Attack Surface* filter shows exactly the organization-linked (`origin=easm`) tasks.

## Known remaining work

- **Notifications env overrides** — add `T4C_NOTIFICATION_*` variables so alerts can be configured purely on Render.
- **ICP cookie freshness** — a health-check alert when the Chinaz cookie expires would prevent silent ICP outages.
- **GeoIP refresh** — the entrypoint only downloads when files are missing; a monthly cron/refresh job would keep city data current.
- **Graph rebuild UX** — expose Neo4j graph rebuild as a one-click admin action when `T4C_NEO4J_ALLOW_REBUILD` is enabled.
