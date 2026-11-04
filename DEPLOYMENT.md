# T4C Deployment Manual

Follow this top to bottom. Every step tells you exactly where to click, what
to type, and which value to copy where. Fill in the worksheet in Step 1 as
you go; every later step references it.

---

## What you are deploying

```
Browser
   |
   v
VERCEL  (the console UI you see)          RENDER  (the engine)
   serves the React app                     runs the Go backend
   forwards /api to Render -------------->  t4c server
                                              |-- Render PostgreSQL  (all data)
                                              |-- Render Key Value   (task queue)
                                              |-- Neo4j Aura         (graph, optional)
                                              '-- GeoIP databases    (map, auto)
```

| Piece | Where it lives | What it costs |
| --- | --- | --- |
| Console UI (React) | Vercel | Free Hobby plan works |
| Go backend | Render Web Service (Docker) | Starter (paid). Free sleeps and breaks scans |
| Database | Render PostgreSQL | Cheapest paid plan (free expires after 30 days) |
| Queue | Render Key Value | Cheapest plan |
| Graph database | Neo4j Aura | Free tier is fine |

**Accounts needed:** GitHub (you have it), Render, Vercel, and optionally Neo4j Aura.

---

## STEP 1: Generate your secrets (5 minutes)

Run these in any terminal. Each prints a random string you will paste into
Render later. Do not skip this step and do not reuse real passwords.

```bash
openssl rand -base64 48     # run once  -> SESSION_SECRET below
openssl rand -base64 24     # run once  -> API_PEPPER below
```

### Worksheet — fill this in as you complete each step

| # | Name | Value | Where you got it |
| --- | --- | --- | --- |
| 1 | SESSION_SECRET | `________________` | command above |
| 2 | API_PEPPER | `________________` | command above |
| 3 | ADMIN_PASSWORD | `________________` | choose your own, 12+ characters |
| 4 | POSTGRES_DSN | `________________` | Step 2 |
| 5 | REDIS_URL | `________________` | Step 3 |
| 6 | RENDER_URL | `________________` | Step 4 (you choose the name) |
| 7 | NEO4J_URI / USER / PASSWORD | `________________` | Step 5 (optional) |

---

## STEP 2: Create the PostgreSQL database on Render

1. Go to <https://dashboard.render.com> and sign in.
2. Click **New +** (top right) -> **Postgres**.
3. Fill the form:
   - **Name**: `t4c-postgres`
   - **Database**: `t4c` (leave the auto-filled value)
   - **Instance**: pick the cheapest **paid** plan (free plans expire after
     30 days)
   - **Region**: any, for example **Oregon (US West)** — remember it, the
     other Render services must use the same region
4. Click **Create Database** and wait until status shows **Available**.
5. On the database page, find the **Connections** section and copy the
   **Internal Database URL**. It looks like:
   `postgres://t4c_xxx:PASSWORD@dpg-xxxxx/t4c_xxx`
6. Paste it into the worksheet as **POSTGRES_DSN**, then **append** this to
   the end of it:
   ```
   ?sslmode=require
   ```
   Final shape:
   `postgres://t4c_xxx:PASSWORD@dpg-xxxxx/t4c_xxx?sslmode=require`

---

## STEP 3: Create the Redis queue on Render

1. Dashboard -> **New +** -> **Key Value**.
2. Fill the form:
   - **Name**: `t4c-redis`
   - **Instance**: smallest paid plan
   - **Region**: same as PostgreSQL
3. Click **Create Key Value**, wait for **Available**.
4. On its page, find **Connections** and copy the **Internal Connection
   String** (click the eye icon if the password is hidden). It looks like:
   `redis://default:PASSWORD@red-xxxxx:6379`
5. Paste it into the worksheet as **REDIS_URL**. If the copied string has no
   password in it, use the format above with your instance's password.

---

## STEP 4: Create the backend Web Service on Render

1. Dashboard -> **New +** -> **Web Service**.
2. Under **Deployment Method** choose **Git Provider** and pick this
   repository (`funbinet/t4c`), branch `main`. Render detects the
   `Dockerfile` at the repo root automatically.
   - If it asks for Runtime: select **Docker**.
   - Docker Build Context Directory: leave as the repo root `/`.
3. Fill:
   - **Name**: `t4c-api` (this name becomes your URL in step 6)
   - **Region**: same as PostgreSQL and Redis
   - **Instance Type**: **Starter** (free instances sleep and cannot run scans)
4. Expand **Advanced** / scroll down and set:
   - **Health Check Path**: `/healthz`
5. Do not deploy yet. First add the environment variables (next section),
   because the service cannot start without them.

### Environment variables (Render -> your service -> Environment -> Add Environment Variable)

Add each row exactly as written. Values come from your worksheet.

| Name (copy exactly) | Value |
| --- | --- |
| `T4C_POSTGRES_DSN` | worksheet #4, ending with `?sslmode=require` |
| `T4C_REDIS_URL` | worksheet #5 |
| `T4C_AUTH_ACCESS_SECRET` | worksheet #1 |
| `T4C_API_KEY_PEPPER` | worksheet #2 |
| `T4C_ADMIN_PASSWORD` | worksheet #3 |
| `T4C_COOKIE_SECURE` | `true` |
| `T4C_SERVER_PUBLIC_URL` | `https://t4c-api.onrender.com` (your real URL, see step 6) |
| `T4C_QUEUE_DRIVER` | `redis` |

Do NOT set these (the Docker image configures them automatically):
`T4C_SERVER_LISTEN`, `T4C_CHROMIUM_PATH`, `T4C_GEOIP_*`, `T4C_STORAGE_*`.

### Optional: persistent disk (recommended)

1. Service page -> **Disks** tab -> **Add Disk**.
2. **Name**: `t4c-data`, **Mount Path**: `/data`, **Size**: 1 GB.
3. This keeps GeoIP databases, screenshots, and exports between deploys.

### Optional: Neo4j (graph view) — see Step 5, then add three more variables

| Name | Value |
| --- | --- |
| `T4C_NEO4J_URI` | worksheet #7 URI |
| `T4C_NEO4J_USER` | `neo4j` |
| `T4C_NEO4J_PASSWORD` | worksheet #7 password |

### Deploy

Click **Manual Deploy** -> **Deploy latest commit** (or it deploys on save).
Watch **Logs** until you see `listening on :10000`. First deploy takes a few
minutes (Docker build).

---

## STEP 5 (optional): Neo4j Aura for the graph view

Everything works without this; only the organization graph view needs it.

1. Go to <https://neo4j.com/aura/> -> **Start Free** -> create an account.
2. Choose **AuraDB Free** (the 0 USD instance) -> create.
3. **Download the credentials file immediately** — the password is shown
   only once.
4. From the file:
   - the connection URI looks like `neo4j+s://xxxxxxxx.databases.neo4j.io`
   - username is `neo4j`
   - password is the long string in the file
5. Put them in the worksheet (#7) and add the three Render environment
   variables from Step 4, then redeploy.

---

## STEP 6: Note your backend URL

Your backend URL is always:

```
https://<service-name>.onrender.com
```

With the suggested name: `https://t4c-api.onrender.com`. You can confirm it
at the top of the Render service page. Write it in the worksheet as
**RENDER_URL** (#6).

Verify now: open `https://<RENDER_URL>/healthz` in a browser — it should
return a small ok response. If it does not, check the Render Logs tab before
continuing.

---

## STEP 7: Deploy the console on Vercel

1. Go to <https://vercel.com> -> sign in with GitHub.
2. **Add New...** -> **Project**.
3. In **Import Git Repository**, find `funbinet/t4c` and click **Import**.
4. On the **Configure Project** page:
   - **Framework Preset**: leave as detected (Vite). `web/vercel.json`
     controls the real build settings.
   - **Root Directory**: click **Edit** and set it to `web` — important,
     this must not stay as the repo root.
   - **Environment Variables**: add one row:
     | Name | Value |
     | --- | --- |
     | `T4C_BACKEND_URL` | worksheet #6, e.g. `https://t4c-api.onrender.com` (no trailing slash) |
5. Click **Deploy** and wait for the build to finish.
6. Your console is live at `https://<project-name>.vercel.app` (shown at the
   end of the build).

---

## STEP 8: First login and verification

1. Open the Vercel URL.
2. Sign in with:
   - **Username**: `admin` (always, it is fixed in the code)
   - **Password**: worksheet #3 (`T4C_ADMIN_PASSWORD`)
3. Open the account menu -> **Change Password** and set a new one.
4. Walk through:
   - **Organizations** -> create one, import root domains by CSV, confirm
     them
   - Start a scan from the organization page
   - **Overview** -> tiles fill in, organizations at risk list populates,
     the map shows assets (needs GeoIP, automatic), graph needs Neo4j

---

## How updates work from now on

- Every `git push` to `main` rebuilds **both** Vercel (console) and Render
  (backend) automatically. Nothing else to do.
- Pull requests get their own preview URL on Vercel, so you can review UI
  changes before merging.

---

## Troubleshooting

| Symptom | Where | Cause and fix |
| --- | --- | --- |
| `502` or `504` when the console loads data | Vercel | Backend asleep (free instance) or `T4C_BACKEND_URL` wrong/with a trailing slash. Fix the env var in Vercel -> Settings -> Environment Variables, then redeploy. |
| Backend logs show `config error` | Render | A required env var is missing or malformed. Compare with the table in Step 4. |
| Backend logs show `pq: SSL is not enabled` or connection refused | Render | `T4C_POSTGRES_DSN` missing `?sslmode=require` or you used the External URL instead of the Internal one. |
| Login says invalid credentials | Render | Password not set before first boot: if `T4C_ADMIN_PASSWORD` was added after the first start, the one-time password is already in the oldest log lines (search Logs for `bootstrap admin created`). Or clear it: Render -> shell not available on Starter; simplest is setting the var and creating a fresh database, or use `t4c admin` locally against the same Postgres. |
| Map card empty, GeoIP chip red | Render | GeoIP download failed (check logs). With a `/data` disk it persists after a manual deploy; without it, every deploy retries. |
| Graph button disabled | Console | Intended: select an organization first. If it stays erroring with an org selected, Neo4j is down or missing (chip on the map card). |
| Tasks stuck in queued | Render | `T4C_QUEUE_DRIVER` not `redis` or Redis unreachable. Check `T4C_REDIS_URL`. |
| Scans die after ~15 min | Render | Instance too small or free tier. Upgrade to Starter or higher. |

## Security reminders

- All secrets live only in the Render/Vercel dashboards, never in the repo.
- The scan blacklist and SSRF protections (`blackCIDRs`,
  `allowPrivate: false`, `allowLoopback: false`) stay enabled; do not relax
  them on a public deployment.
- If `SESSION_SECRET` leaks, set a new one and redeploy (all sessions reset).
