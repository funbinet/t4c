# T4C API Integration Guide

How to create, use, and govern **API keys** for the T4C platform — for CI pipelines, SOAR/SIEM playbooks, chat bots, scripts, and any other system that needs machine access to the REST API.

---

## 1. Where API keys work

T4C exposes everything under `https://<your-host>/api/v1` (OpenAPI 3.1 at `/api/v1/openapi.json`, interactive docs at `/api/v1/docs`). Two authentication modes exist:

| Mode | Mechanism | Used by |
| --- | --- | --- |
| Browser session | HttpOnly cookie `t4c_access` + `X-CSRF-Token` on writes | The React console |
| **API key** | `X-API-Key` request header | Scripts, CI/CD, integrations, bots |

API keys are the correct mechanism for **headless systems**: GitHub Actions / GitLab CI recon jobs, n8n / SOAR playbooks, Grafana-side scripts, Slack/DingTalk bots, scheduled exporters, or a corporate SIEM pulling risk data.

## 2. Creating a key

1. Sign in to the console as an **admin**.
2. Open **Administration → API Key** and press the **+** (New Key) button.
3. Give it a descriptive name (e.g. `ci-weekly-recon`) and a comma-separated scope list.
4. The raw key is shown **once** in the "Save API Key" dialog. Copy it immediately — only a SHA-256 hash (peppered) is stored server-side, so it can never be read again.
5. Revoking a key (the ✕ action) is instant; `lastUsed` lets you detect unused keys.

### Scopes

Only three scope values are valid; anything else is rejected at creation time.

| Scope | Effective role | Can do |
| --- | --- | --- |
| `read` | viewer | All GET endpoints: organizations, assets, risks, tasks, monitors, exports, overview, map, graph |
| `scan` | operator | Everything `read` can, **plus** write/scan actions: create scans/tasks (`POST /tasks`, `POST /organizations/{id}/scans`), add/confirm domains, ICP lookup (`POST /organizations/{id}/icp-refresh`), create monitors/schedules/policies, exports |
| `admin` | admin | Everything, including user management, API key management, recycle-bin restore, and system settings |

The scope list is additive: `read,scan` is the common choice for automation; use `admin` only for management tooling.

## 3. Using a key

Send the raw key in the `X-API-Key` header on every request. No cookie, no CSRF token, no login call.

```bash
export T4C_URL="https://t4c-api.onrender.com"
export T4C_KEY="t4c_…"   # the value shown once at creation

# List organizations
curl -sS -H "X-API-Key: $T4C_KEY" "$T4C_URL/api/v1/organizations?q=acme" | jq

# Full recon of an organization:
#   1. add candidate root domains
curl -sS -X POST -H "X-API-Key: $T4C_KEY" -H "Content-Type: application/json" \
  -d '{"domains":["example.edu.cn"]}' \
  "$T4C_URL/api/v1/organizations/$ORG_ID/domains/import"

#   2. run the ICP reverse lookup (locates filed domains + ownership evidence)
curl -sS -X POST -H "X-API-Key: $T4C_KEY" \
  "$T4C_URL/api/v1/organizations/$ORG_ID/icp-refresh"

#   3. confirm ownership, then launch one scan task per confirmed domain
curl -sS -X POST -H "X-API-Key: $T4C_KEY" -H "Content-Type: application/json" \
  -d '{"rootDomains":["example.edu.cn"]}' \
  "$T4C_URL/api/v1/organizations/$ORG_ID/domains/confirm"
curl -sS -X POST -H "X-API-Key: $T4C_KEY" -H "Content-Type: application/json" \
  -d '{"rootDomains":["example.edu.cn"]}' \
  "$T4C_URL/api/v1/organizations/$ORG_ID/scans"

# Read results back
curl -sS -H "X-API-Key: $T4C_KEY" "$T4C_URL/api/v1/organizations/$ORG_ID/assets"
curl -sS -H "X-API-Key: $T4C_KEY" "$T4C_URL/api/v1/organizations/$ORG_ID/findings"
curl -sS -H "X-API-Key: $T4C_KEY" "$T4C_URL/api/v1/organizations/$ORG_ID/tasks"
curl -sS -H "X-API-Key: $T4C_KEY" "$T4C_URL/api/v1/organizations/$ORG_ID/summary"

# Organization-scoped task creation is also supported directly:
curl -sS -X POST -H "X-API-Key: $T4C_KEY" -H "Content-Type: application/json" \
  -d '{"name":"nightly","kind":"domain","target":"example.edu.cn","organizationId":"'$ORG_ID'"}' \
  "$T4C_URL/api/v1/tasks"

# Download an XLSX report
curl -sS -X POST -H "X-API-Key: $T4C_KEY" \
  "$T4C_URL/api/v1/organizations/$ORG_ID/exports?format=xlsx" | jq -r .downloadUrl
```

Every key use is recorded: `lastUsed` updates on each request, and API activity appears in the Audit Log under the actor name `api-key:<name>`.

## 4. Operational guidance

- **One key per consumer.** Name keys after the system (`gh-actions-recon`, `n8n-soar`), so audit trails and revocation stay precise.
- **Least privilege.** Dashboards that only read → `read`. Pipelines that trigger scans → `read,scan`. Reserve `admin` for configuration management.
- **Rotate and prune.** Check the `Last used` column on the API Key screen monthly; revoke anything stale. Keys live in the recycle bin history after revocation.
- **Transport.** Always call T4C over HTTPS; the raw key is a bearer credential.
- **Storage.** Keep keys in your CI secret store (GitHub Actions secrets, Render/Vercel env vars, Vault) — never in repositories or tickets.
- **Rate discipline.** Scans fan out into queued jobs on the Redis queue; poll `/organizations/{id}/tasks` rather than re-submitting.
