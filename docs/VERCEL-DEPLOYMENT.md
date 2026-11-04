# Vercel Deployment

The console is a Vite SPA. Vercel hosts the frontend; the Go backend (which
needs PostgreSQL, Redis, Neo4j, GeoIP, and scanner assets) must run somewhere
with a public HTTPS endpoint, for example your own server, Fly.io, Render, or
Railway. Vercel acts as a reverse proxy for API traffic so cookies and CSRF
keep working same-origin.

## How it works

- `web/vercel.json` sets the build command, output directory, and routing.
- `/api/*`, `/healthz`, `/readyz` are proxied to the backend URL stored in the
  `T4C_BACKEND_URL` environment variable (expanded at request time by Vercel
  routing with the routes `env` allowlist).
- Everything else falls back to `/index.html` for SPA routing.

## Steps

1. Push this repository to GitHub (Vercel Git integration builds on every
   push, so new changes show up automatically).
2. In Vercel: Add New Project, import the repository.
3. Set Root Directory to `web`.
4. Add the environment variable `T4C_BACKEND_URL` (Production + Preview) with
   your backend base URL, for example `https://api.example.com`. No trailing
   slash.
5. Deploy. Framework presets are not needed; `web/vercel.json` controls the
   build (`T4C_WEB_OUT_DIR=dist npm run build`, output `dist`).

## Notes

- Local builds are unchanged: `npm run build` still writes to
  `../internal/webui/dist` for the embedded Go binary.
- `web/.env.example` documents the variable for local testing against a
  remote backend.
- Live updates: every push to the connected branch creates a new deployment;
  pull requests get preview URLs.
- Streaming (SSE task streams) goes through the Vercel proxy; if a backend
  change adds long-lived streams, verify buffering behavior after deploy.
