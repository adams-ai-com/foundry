# Foundry (Unified Open-Source Workspace)

pnpm monorepo (Turborepo). AGPL-licensed open-source workspace replacing MS 365 / Google Workspace: Mail (our own server), Docs, Sheets, Channels, Files, Wiki, Tasks, Decisions. Workspace-first architecture. AI-native. Adams AI manages self-hosted instances for verticals. Working copy lives here on the control box; running on foundry-srv.

## Remote host
- **Server**: foundry-srv `142.93.61.78`
- **SSH**: `sudo -u manager ssh -n -i ~manager/.ssh/id_ed25519 manager@142.93.61.78 '<cmd>'`
- **Repo on server**: cloned to `/var/www/foundry` as `foundry` unix user from `github.com/adams-ai-com/foundry`

## Monorepo layout
- `apps/workspace` — Auth shell: magic-link login, org management, app launcher (port 3000) ← **entry point**
- `apps/docs` — Foundry Docs (word processor, port 3001)
- `apps/sheets` — Foundry Sheets (spreadsheets, port 3003)
- `apps/mail` — Foundry Mail client (Next.js, port 3004, proxies to mailserver)
- `apps/wiki` — Foundry Wiki (knowledge base, port 3005)
- `services/mailserver` — Foundry Mail server (Node.js, port 3100, REST API + SMTP)
- `packages/` — shared libs

## Public URL
`https://foundry.adams-ai.com` → nginx → workspace shell at port 3000.
nginx routes: `/docs`→3001, `/sheets`→3003, `/mail`→3004, `/wiki`→3005, `/`→3000.
Cloudflare proxied (free TLS). Self-signed origin cert at `/etc/ssl/certs/foundry-origin.crt`.

## Services on foundry-srv

| Service | Unit | Port | Secrets |
|---|---|---|---|
| Workspace | `foundry-workspace.service` | 3000 | `/var/www/foundry/apps/workspace/.env` |
| Docs | `foundry-docs.service` | 3001 | `/var/www/foundry/apps/docs/.env` |
| Sheets | `foundry-sheets.service` | 3003 | `/var/www/foundry/apps/sheets/.env` |
| Mail client | `foundry-mail-client.service` | 3004 | `/var/www/foundry/apps/mail/.env` |
| Wiki | `foundry-wiki.service` | 3005 | `/var/www/foundry/apps/wiki/.env` |
| Mail server | `foundry-mail.service` | 3100 (localhost) | `/etc/foundry-mail/secrets.env` (640 root:foundry) |

## Workspace auth model
- Magic-link login (email → token → session cookie `foundry_session`, 30-day)
- `foundry_workspace` DB: `users`, `orgs`, `org_members`, `sessions`, `magic_tokens`
- If `SMTP_HOST` unset (current default), magic links log to stdout — check with `journalctl -u foundry-workspace | grep "MAGIC LINK"`
- Schema migration: `psql "$DATABASE_URL" -f /var/www/foundry/apps/workspace/lib/schema.sql`
- All .env DATABASE_URLs derived from `/etc/foundry-mail/secrets.env` (authoritative password source)

## Migrations (run after schema changes)
```bash
# workspace
WURL=$(grep DATABASE_URL /var/www/foundry/apps/workspace/.env | cut -d= -f2-)
sudo -u foundry psql "$WURL" -f /var/www/foundry/apps/workspace/lib/schema.sql
# wiki
WURL=$(grep DATABASE_URL /var/www/foundry/apps/wiki/.env | cut -d= -f2-)
sudo -u foundry psql "$WURL" -f /var/www/foundry/apps/wiki/lib/schema.sql
```

## Wiki migration
- DB: `foundry_wiki`; DATABASE_URL in `/var/www/foundry/apps/wiki/.env`

## Mail deployment (non-blue-green — simple pnpm start)
- Mail client: `pnpm --filter @foundry/mail start` from `/var/www/foundry`
- Mail server: `node dist/index.js` from `/var/www/foundry/services/mailserver`
- Rebuild server on changes: write `/tmp/build-mail.sh` (`cd /var/www/foundry && pnpm --filter @foundry/mail build`) then `sudo -u foundry /tmp/build-mail.sh`
- Rebuild mailserver: `sudo -u foundry npm run build --prefix /var/www/foundry/services/mailserver`

## Mail server config
- Account `foundry01` in `foundry_mail` DB (domain: `foundry.local`)
- No SMTP_PORT set → receiver disabled (set SMTP_PORT=25 + CAP_NET_BIND_SERVICE when ready for real mail)
- DKIM: not yet configured (set DKIM_PRIVATE_KEY_PATH + DKIM_SELECTOR when deploying for real)
- Run migration after schema changes: `sudo -u foundry DATABASE_URL="..." node dist/migrate.js`

## Databases
- PG on foundry-srv: `foundry_workspace`, `foundry_docs`, `foundry_sheets`, `foundry_mail`, `foundry_wiki` (owner: `foundry`)
- `foundry` postgres role has password (TCP scram-sha-256 auth); stored in `/etc/foundry-mail/secrets.env`
- All app `.env` files derive their DATABASE_URL from that password — use `/tmp/fix-all-envs.sh` pattern to regenerate if needed

## Notes
- No monitor probe yet on foundry-srv.
- No AGM backup pull yet.
- 2 GB swap active on foundry-srv (`/swapfile`, persisted in `/etc/fstab`)
- `foundry-docs-blue.service` (old blue-green unit) was stopped/disabled 2026-05-18 — replaced by `foundry-docs.service`

## What's next (pick up here)
1. **Test auth flow end-to-end**: go to `https://foundry.adams-ai.com`, enter email, grab magic link from `journalctl -u foundry-workspace | grep "MAGIC LINK"`, create org, verify launcher works
2. **Wire SMTP** so magic links go to email: set `SMTP_HOST/PORT/USER/PASS/FROM` in `/var/www/foundry/apps/workspace/.env` and restart service
3. **Auth middleware for individual apps**: add `packages/auth` middleware so `/docs`, `/sheets`, `/mail`, `/wiki` also require a session — currently open to anyone who knows the port
