# Foundry — Self-Host Quickstart

Run Foundry on your own server with Docker. Your data stays on your infrastructure.

## Requirements
- A Linux host with **Docker** + the Compose plugin (`docker compose version`).
- ~2 vCPU / 4 GB RAM to start.

## Run
```bash
git clone https://github.com/adams-ai-com/foundry.git
cd foundry
cp .env.example .env
# edit .env — set a strong POSTGRES_PASSWORD; set FOUNDRY_DOMAIN for TLS (optional)
docker compose up -d --build
```
First build takes a few minutes (it builds each app image). Then open
**http://localhost** (or your `FOUNDRY_DOMAIN`). On first run you'll be prompted to
**create the administrator account** — that account owns the workspace and invites others.

No SMTP, no authenticator app required: login is email + password.

## What's included
| App | Path | Status |
|---|---|---|
| Workspace (auth shell, org, launcher) | `/` | ✅ |
| Docs (word processor) | `/docs` | ✅ |
| Sheets (spreadsheets) | `/sheets` | ✅ |
| Sites (CMS) | `/sites` | ✅ |
| Wiki | `/wiki` | ✅ |
| Mail (client + server) | `/mail` | ✅ (internal mail; set `SMTP_RELAY_*` for outbound) |
| PDF (editor + processing engine) | `/pdf` | ✅ |
| Channels (chat/video) | `/channels` | ⏳ next |

Log in once at `/` and your session works across every app.

## Operating
- Logs: `docker compose logs -f workspace`
- Stop: `docker compose down` (data persists in named volumes)
- Reset everything (DESTROYS DATA): `docker compose down -v`
- Backups: snapshot the `pgdata` volume / `pg_dump` each `foundry_*` database.

## Security
- Set a strong `POSTGRES_PASSWORD`.
- Put Foundry behind your firewall; expose only via the Caddy proxy (set `FOUNDRY_DOMAIN` for automatic HTTPS).
- Report vulnerabilities per `SECURITY.md`.
