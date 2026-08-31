# VPS Deployment Guide — spain-address-autocomplete demo

Target: **OVH VPS-1 2027** (2 vCores · 4 GB RAM · 40 GB NVMe) running the two
HTTP BFFs for the public demo. Static examples/docs live on Cloudflare Pages;
the VPS is exposed through a Cloudflare Tunnel on **`calle.alami.es`** (subdomain
of the existing `alami.es` zone — no new domain purchase).

> **Not deployed here:** the MCP server. It is a stdio process spawned by MCP
> clients (Claude Desktop, Cursor) on the *user's* machine — there is nothing to
> host. The VPS only serves the browser-facing demo APIs.

```
                               [OVH VPS  (127.0.0.1, localhost)]
[Cloudflare Pages]                         ┌─ typesense :8108   (callejero_es 749K + cascade_es 18K)
 examples + widget  ──HTTPS──►  Tunnel     ├─ cascade BFF :5978  (provincia→municipio→CP, HTTP)
(calle.alami.es)                          └─ proxy BFF   :<PROXY_PORT>  (fuzzy street search)
        ▲                                       │  both query
        │  (Workers can call these over        TypeSense HTTP/REST
        │   the Tunnel — raw RESP is NOT
        │   Worker-reachable, which is exactly
        │   why the cascade was ported off redis)
```

> **Why HTTP, not RESP:** a Cloudflare Worker calls upstreams with `fetch()`
> only. Raw Redis/RESP (redis-stack on `:6379`) is TCP-only and is *not*
> reachable from a Worker. Both BFFs speak HTTP/REST to Typesense, so a Worker
> can sit in front of — or fan-out to — `calle.alami.es/api/geo/*` and
> `/api/address-search` through the Tunnel.

---

## 0. Provision the VPS

- **OS: Ubuntu 24.04 LTS**
- **Region:** closest available to your users (no ES region — France/Germany/Poland are all ~20–40 ms from Madrid)
- Add your **SSH public key** during checkout (`ssh-keygen -t ed25519` on your Mac if needed)
- Note the public IP → referred to below as `<VPS_IP>`
- **Domain:** none to buy — `alami.es` is already on Cloudflare, so the demo
  hostname `calle.alami.es` is created by the tunnel in §8 (DNS + TLS automatic).

---

## 1. First login + base hardening

> **Ubuntu-only VPS (key-only `ubuntu` user, no root SSH)?** This is the default
> for Ubuntu cloud images (root is locked; sshd defaults to `PermitRootLogin
> prohibit-password`). You have two choices:
> - **(A, recommended) stay on `ubuntu`** and prepend `sudo` to every privileged
>   command below (`adduser deploy` is optional — use `User=ubuntu` in the systemd
>   units). No root login needed.
> - **(B) enable root SSH key login** so this guide's `ssh root@…` works verbatim:
>   from the `ubuntu` session run
>   `sudo install -m 700 -o root -g root -d /root/.ssh && sudo cp /home/ubuntu/.ssh/authorized_keys /root/.ssh/authorized_keys && sudo chmod 600 /root/.ssh/authorized_keys && sudo sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config && sudo systemctl restart ssh`,
>   then `ssh root@<VPS_IP>`. Prefer `prohibit-password` (key-only) over `yes`.

```bash
ssh root@<VPS_IP>     # §1 assumes root; if you chose (A), use `ssh ubuntu@<VPS_IP>` + `sudo`

apt update && apt -y upgrade

# Non-root user
adduser deploy
usermod -aG sudo deploy
```

On your Mac, copy your key over, then log back in as `deploy`:

```bash
ssh-copy-id deploy@<VPS_IP>
ssh deploy@<VPS_IP>
```

Firewall — with a Cloudflare Tunnel you need **no inbound web ports at all**
(the tunnel is outbound-only), so only SSH stays open:

```bash
sudo ufw allow OpenSSH
sudo ufw --force enable
sudo ufw status          # → 22/tcp ALLOW

sudo apt install -y fail2ban unattended-upgrades
```

---

## 2. Add 2 GB swap

The street-index import of 749K docs is the only memory-spiky moment; swap makes
it boring.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h                  # Swap: 2.0Gi
```

---

## 3. Install Docker

Official Docker apt repo (Ubuntu 24.04 / noble):

```bash
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker deploy
exit && ssh deploy@<VPS_IP>     # re-login so the group applies
docker run --rm hello-world
```

> Use `docker compose` (v2 plugin) — not the legacy `docker-compose` binary.

---

## 4. Install Node 22 + pnpm 9

Ubuntu's own Node is too old; use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pnpm@9
node --version    # v22.x
pnpm --version    # 9.x
which pnpm        # remember this path (usually /usr/bin/pnpm) — needed in step 7
```

---

## 5. Get the code + the dataset

```bash
git clone https://github.com/Karim-capatlas/spain-address-autocomplete.git
cd spain-address-autocomplete
pnpm install --frozen-lockfile
```

The ~22 MB snapshot is **not committed** to the repo. Two options — pick one:

**Option A (fast):** copy your local snapshot up:

```bash
# run on your Mac
scp packages/data/snapshots/callejero_2026-01.jsonl.gz \
  deploy@<VPS_IP>:~/spain-address-autocomplete/packages/data/snapshots/
```

**Option B:** regenerate on the VPS (downloads from INE, slower):

```bash
cd packages/etl && pnpm exec tsx src/index.ts run --year 2026 --month 1   # tsx is a per-package devDep; `pnpm exec tsx` from the workspace root does not resolve on a fresh install
```

---

## 6. Start Typesense + import both indexes

Typesense is the **single** backend for both indexes. Run it via the local
compose file (binds `127.0.0.1:8108`, key `xyz`):

```bash
docker compose up -d typesense
docker compose ps                      # wait until the typesense healthcheck is "healthy"
curl http://127.0.0.1:8108/health      # → {"ok":true}
```

> Security: the compose service binds Typesense to `127.0.0.1:8108`. Keep it that
> way — the API key (`xyz` here) is the only access control, and no container
> port is exposed to the world.

Build the workspace, then import both collections (each command rebuilds `core`
via the `preimport` hook):

```bash
# Street index — 749,261 docs over HTTP (~4-6 min on 2 vCores)
pnpm typesense:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop --batch-size 1000

# Cascade index — 52 provincias / 8,106 municipios / 10,127 CPs (seconds)
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
```

Verify both collections:

```bash
curl -s -H "x-typesense-api-key: xyz" "http://127.0.0.1:8108/collections/callejero_es" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).num_documents"  # → 749261
curl -s -H "x-typesense-api-key: xyz" "http://127.0.0.1:8108/collections/cascade_es" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).num_documents"  # → 18285
```

---

## 7. Run the BFFs with systemd

Typesense runs in Docker (restart policy `unless-stopped`). The two small Hono
BFFs run as plain Node services — lighter than building images on 2 vCores.

The cascade BFF needs the Typesense connection + its port:

`/etc/systemd/system/spain-cascade.service`:

```ini
[Unit]
Description=spain-address cascade server (provincia→municipio→CP)
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
User=deploy
WorkingDirectory=/home/deploy/spain-address-autocomplete
Environment=TYPESENSE_HOST=127.0.0.1
Environment=TYPESENSE_PORT=8108
Environment=TYPESENSE_PROTOCOL=http
Environment=TYPESENSE_API_KEY=xyz
Environment=CASCADE_PORT=5978
Environment=CASCADE_COLLECTION=cascade_es
# CORS: comma list of allowed browser origins. Omit to reflect any Origin (demo).
# Environment=CORS_ORIGINS=https://<your-site>.pages.dev,http://localhost:8000
ExecStart=/usr/bin/pnpm --filter @spain-address/cascade start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

The proxy BFF:

`/etc/systemd/system/spain-proxy.service`:

```ini
[Unit]
Description=spain-address search proxy (fuzzy street search)
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
User=deploy
WorkingDirectory=/home/deploy/spain-address-autocomplete
Environment=TYPESENSE_HOST=127.0.0.1
Environment=TYPESENSE_PORT=8108
Environment=TYPESENSE_PROTOCOL=http
Environment=TYPESENSE_API_KEY=xyz
Environment=PORT=8787
# CORS: comma list of allowed browser origins. Omit to reflect any Origin (demo).
# Environment=CORS_ORIGINS=https://<your-site>.pages.dev,http://localhost:8000
ExecStart=/usr/bin/pnpm --filter @spain-address/proxy start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

> Replace `/usr/bin/pnpm` with your `which pnpm` output if different, and set `PORT`
> to whatever `packages/proxy/src/cli.ts` exposes (currently `8787`).

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now spain-cascade spain-proxy
systemctl status spain-cascade spain-proxy --no-pager
journalctl -u spain-cascade -f     # logs

# Local smoke test
curl localhost:5978/api/geo/provincias | head -c 200
curl localhost:5978/api/geo/validate-cp?municipio=28079\&cp=28013   # → {"valid":true,"ineCode":"28079"}
curl localhost:8787/health
```

---

## 8. HTTPS via Cloudflare Tunnel on calle.alami.es

Uses a dashboard-managed (token) tunnel — no certs, no open ports, free. Because
`alami.es` is already a Cloudflare zone, there is nothing to transfer.

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Add tunnel** →
   cloudflared → name it `calle-demo` → copy the tunnel **token**.
2. Install cloudflared on the VPS (Cloudflare apt repo):

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
sudo chmod a+r /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

sudo cloudflared service install <TUNNEL_TOKEN>
systemctl status cloudflared --no-pager
```

3. Back in the dashboard, open the tunnel → **Public hostnames** — and add
   **one** hostname with **two** rules. The route prefixes never collide
   (`cascade` owns `/api/geo/*`, the proxy owns `/api/address-search`), so a
   single name fronts both services:

| Order | Subdomain | Domain | Path | Service |
|---|---|---|---|---|
| 1 (first) | `calle` | `alami.es` | `^/api/geo` | `http://localhost:5978` |
| 2 (catch-all) | `calle` | `alami.es` | *(empty)* | `http://localhost:8787` |

   Rules evaluate top-down — the path rule must come first. The DNS record for
   `calle.alami.es` is created automatically, and TLS is covered by the existing
   universal `*.alami.es` certificate.

   > Note: `https://calle.alami.es/` with no path lands on the proxy and will
   > 404 — fine for an API-only hostname; the demo page lives on Pages.

Verify from your Mac:

```bash
curl https://calle.alami.es/api/geo/provincias | head -c 200
curl "https://calle.alami.es/api/geo/validate-cp?municipio=28079&cp=28013"   # → {"valid":true,"ineCode":"28079"}
curl "https://calle.alami.es/api/address-search?q=gran%20via" | head -c 300
```

---

## 9. CORS — handled, but lock it down

Both BFFs ship with permissive CORS (they reflect the request `Origin` by
default so a Pages-hosted demo works immediately). In production, pin the
allow-list via the env block in §7:

```ini
Environment=CORS_ORIGINS=https://<your-site>.pages.dev
```

Then restart:

```bash
cd ~/spain-address-autocomplete && git pull
sudo systemctl restart spain-cascade spain-proxy
```

Point the Cloudflare Pages example at the single API base:

```html
<address-search-es endpoint="https://calle.alami.es/api/address-search"></address-search-es>
```

(cascade dropdown calls go to `https://calle.alami.es/api/geo/...`).

---

## 10. Known gotchas

- **Docker build of `cascade` is likely broken as committed.** The legacy
  `packages/cascade/Dockerfile` expects the repo-root build context; the
  systemd path in §7 (`pnpm --filter … start`, i.e. `tsx`) does **not** need it.
  If you ever want the containerized variant instead of systemd, run
  `docker compose build cascade` locally first and confirm the `CONTEXT` in the
  compose `build:` stanza is the repo root.
- **Proxy port** — the proxy reads `PORT` (default `8787`, see
  `packages/proxy/src/cli.ts`); the service file in §7 sets `PORT=8787`.
  Update both if you change it.
- **Imports are one-way & idempotent** — re-running `pnpm typesense:import …
  --drop` or `pnpm cascade:import … --drop` is safe; safe to redo after a data
  refresh.
- **Composite doc ids** — the cascade collection keys every doc by
  `type:code` (e.g. `cp:28013`, `municipio:28079`) so a postal code and a
  municipio code that share digits never overwrite each other. Don't revert to a
  bare code as the Typesense `id`.
- **Typesense `per_page` ≤ 250** — the cascade store paginates internally; don't
  raise it.
- **Cloudflare edge 403 = security challenge, not a tunnel/DNS error.** A proxied
  `calle.alami.es` CNAME is correct and the tunnel connects (BFFs return `200` at
  `localhost:5978`/`8787`), but the `alami.es` zone's defaults — **Bot Fight Mode**
  and **Browser Integrity Check** (and the "managed challenge") — return a `403
  Just a moment…` page for non-browser clients like `curl`/health probes. The fix
  is on the Cloudflare side, not the VPS: in the dashboard disable **Bot Fight
  Mode** (Security → Bots) and **Browser Integrity Check** (Security → Overview)
  for the demo, or add a **WAF override** scoped to hostname `calle.alami.es`
  path `/api/*` with *Managed Challenge: Off* + *Security Level: Essentially off*
  (keeps the rest of the zone protected). After toggling,
  `curl https://calle.alami.es/api/geo/provincias` returns `200` within seconds.
- **Upgrading later:** if you buy a dedicated domain (e.g. `elcallejero.es`),
  only the tunnel's public hostname changes — nothing on the VPS does.

---

## 11. Maintenance

- **INE data refresh (Jan + Jul):** re-run the ETL locally → `scp` the new
  snapshot → re-run both imports (step 6) →
  `sudo systemctl restart spain-cascade spain-proxy`.
- **Updates:** `sudo apt update && sudo apt -y upgrade` monthly;
  unattended-upgrades already covers security patches.
- **Backups:** VPS-1 includes a daily 24h snapshot of the Typesense data volume
  (`typesense-data`). The demo is fully reproducible from this guide + the repo,
  so backups are a convenience, not a lifeline.
- **Logs:** `journalctl -u spain-cascade -u spain-proxy --since today`;
  `docker compose logs -f typesense`.
- **Typesense version:** pinned to `30.2` (matches the macOS Homebrew dev box).
  When you upgrade, re-index both collections after the version bump.

## Cost recap

| Item | Cost |
|---|---|
| VPS-1 2027 (12-mo upfront) | ~€3.81/mo excl. VAT (~€46 + IVA / year) |
| Domain | **€0** — `calle.alami.es` subdomain |
| Cloudflare Tunnel + Pages | €0 |
| **Total** | **under €5/month** |
