# T4C Deployment Manual

End-to-end guide for running T4C live: the Go backend on Render, the React
console on Vercel, and the glue between them. Every push to `main` rebuilds
both, so changes go live automatically.

## Architecture

```
Browser
  |
  v
Vercel (web/)                     Render (Dockerfile)
  static SPA + /api proxy  ---->  t4c all --config=   (single Go binary)
                                  |-- PostgreSQL  (Render Postgres)
                                  |-- Redis       (Render Key Value)
                                  |-- Neo4j       (Neo4j Aura, optional)
                                  |-- GeoIP       (DBIP lite, auto-download)
                                  '-- Chromium    (screenshots, in image)
```

- Vercel serves the console and reverse-proxies `/api/*`, `/healthz`,
  `/readyz` to the backend URL in `T4C_BACKEND_URL`. Cookies and CSRF stay
  same-origin, so no CORS changes are needed.
- The backend is configured entirely through `T4C_*` environment variables;
  no config file is required (`--config=` loads defaults + env).
- Accounts needed: Render, Vercel, GitHub, and (optional) Neo4j Aura.

---

## Part A: Render backend

### A1. Create the databases

1. **PostgreSQL**: Render Dashboard -> New -> Postgres. Pick a region, create,
   then copy the **Internal Database URL**. It looks like
   `postgres://user:pass@dpg-xxx/database` — append `?sslmode=require`.
2. **Redis**: New -> Key Value. Copy the connection string and format it as
   `redis://default:PASSWORD@HOST:6379`.
3. **Neo4j (optional)**: create a free instance at
   [neo4j.com/aura](https://neo4j.com/aura/). Save the credentials; the URI
   looks like `neo4j+s://xxxxxxxx.databases.neo4j.io`. The console works
   without it; only the relationship graph view needs it.

### A2. Create the web service

1. New -> Web Service -> Build and deploy from a Git repository -> connect
   this GitHub repo.
2. Runtime: **Docker** (the repo-root `Dockerfile` is detected automatically).
3. Instance type: Starter or higher. Free instances sleep, lose the local
   disk, and cannot run long scans reliably.
4. Health check path: `/healthz`.
5. Optional but recommended: Disks -> add a disk mounted at `/data` so
   GeoIP databases, screenshots, and exports survive redeploys.

### A3. Environment variables

Set these in Render -> Web Service -> Environment:

| Variable | Value |
| --- | --- |
| `T4C_POSTGRES_DSN` | Internal Database URL + `?sslmode=require` |
| `T4C_REDIS_URL` | `redis://default:PASSWORD@HOST:6379` |
| `T4C_AUTH_ACCESS_SECRET` | `openssl rand -base64 48` output |
| `T4C_API_KEY_PEPPER` | another random string |
| `T4C_ADMIN_PASSWORD` | initial admin password (omit to get a one-time random password in the service log) |
| `T4C_COOKIE_SECURE` | `true` |
| `T4C_SERVER_PUBLIC_URL` | `https://<your-service>.onrender.com` |
| `T4C_QUEUE_DRIVER` | `redis` (already the image default) |
| `T4C_NEO4J_URI` / `T4C_NEO4J_USER` / `T4C_NEO4J_PASSWORD` | Aura credentials (optional) |

Optional overrides: `T4C_GEOIP_DOWNLOAD=0` disables the automatic DBIP
download, `T4C_GEOIP_CITY` / `T4C_GEOIP_ASN` point at your own mmdb files.

The image sets storage paths (`/data/t4c/...`), `T4C_CHROMIUM_PATH`, and the
entrypoint downloads GeoIP databases, runs `t4c migrate`, then starts
`t4c all`.

### A4. First start

1. Deploy and watch the logs. You should see migrations apply, then
   `listening on :10000`.
2. If `T4C_ADMIN_PASSWORD` was not set, the **admin password is printed to
   the service log only once** — copy it immediately.
3. Verify `https://<your-service>.onrender.com/healthz` returns ok.

---

## Part B: Vercel frontend

Details live in `docs/VERCEL-DEPLOYMENT.md`; the short version:

1. Vercel -> Add New Project -> import the GitHub repo.
2. Root Directory: `web`. Everything else is automatic (`web/vercel.json`):
   build `T4C_WEB_OUT_DIR=dist npm run build`, output `dist`.
3. Environment variable (Production + Preview):
   `T4C_BACKEND_URL = https://<your-service>.onrender.com` (no trailing
   slash).
4. Deploy. Every push to `main` creates a new production deployment; pull
   requests get preview URLs.

---

## Part C: First-run checklist

1. Open the Vercel URL, sign in with `admin` and the bootstrap password.
2. Change the password from the account menu.
3. Create an organization, import root domains (CSV), confirm them, and run a
   scan. The Overview wallboard fills in as scans complete.
4. Check the map (needs GeoIP) and the graph view (select an organization;
   needs Neo4j).

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Vercel shows 502/504 on API calls | Backend asleep (free tier) or wrong `T4C_BACKEND_URL`. Check the Render service. |
| Login loops or CSRF errors | `T4C_SERVER_PUBLIC_URL` must match the Render URL; cookies require HTTPS (keep `T4C_COOKIE_SECURE=true`). |
| Map is empty | GeoIP download failed; check logs, or mount your own mmdb files via `T4C_GEOIP_CITY` / `T4C_GEOIP_ASN`. |
| Graph button disabled / graph unavailable | Select an organization first; the graph also needs Neo4j credentials. |
| Queued tasks never start | `T4C_QUEUE_DRIVER` must be `redis` and the Redis URL must be reachable from the service. |
| Long scans die | Free Render instances sleep and cap CPU; upgrade the instance type. |

## Security notes

- Never commit secrets; use the dashboard environment variables.
- The scan blacklist / SSRF protections in `config.example.yaml`
  (`blackCIDRs`, `allowPrivate: false`, `allowLoopback: false`) remain
  enforced; do not relax them for a public deployment.
- Set `T4C_ADMIN_PASSWORD` or capture the one-time log password at first
  boot; rotate the access secret by redeploying with a new value (sessions
  reset).
