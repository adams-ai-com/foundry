# Foundry (Unified Open-Source Workspace)

pnpm monorepo (Turborepo). AGPL-licensed open-source workspace replacing MS 365 / Google Workspace: Mail (our own server), Docs, Sheets, Channels, Files, Wiki, Tasks, Decisions. Workspace-first architecture. AI-native. Adams AI manages self-hosted instances for verticals. Working copy lives here on the control box; running on foundry-srv.

## Remote host
- **Server**: foundry-srv `142.93.61.78`
- **SSH**: `sudo -u manager ssh -n -i ~manager/.ssh/id_ed25519 manager@142.93.61.78 '<cmd>'`
- **Repo on server**: cloned to `/var/www/foundry` as `foundry` unix user from `github.com/adams-ai-com/foundry`

## Monorepo layout
- `apps/docs` — Foundry Docs (word processor)
- `apps/sheets` — Foundry Sheets (spreadsheets)
- `apps/mail` — Foundry Mail client (Next.js, port 3004, proxies to mailserver)
- `services/mailserver` — Foundry Mail server (Node.js, port 3100, REST API + SMTP)
- `packages/` — shared libs

## Services on foundry-srv

| Service | Unit | Port | Secrets |
|---|---|---|---|
| Docs (blue) | `foundry-docs-blue.service` | 3001 (live) | `/etc/foundry-docs/secrets.env` |
| Sheets | `foundry-sheets.service` | 3003 | `/var/www/foundry/apps/sheets/.env` |
| Mail client | `foundry-mail-client.service` | 3004 | `/var/www/foundry/apps/mail/.env` |
| Mail server | `foundry-mail.service` | 3100 (localhost) | `/etc/foundry-mail/secrets.env` (640 root:foundry) |

## Blue-green deployment (Docs)
- Blue port: **3001** (currently live), Green port: 4001
- Slot state: `/etc/adams/slots/foundry-docs` on server
- Service units: `foundry-docs-blue.service`, `foundry-docs-green.service`
- WorkingDirectory: `/var/www/foundry-blue/apps/docs` (ExecStart: `node apps/docs/server.js`)
- Slot dirs: `/var/www/foundry-blue/`, `/var/www/foundry-green/`

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
- PG on foundry-srv: `foundry_docs`, `foundry_sheets`, `foundry_mail` (owner: `foundry`)
- `foundry` postgres role has password (TCP scram-sha-256 auth); stored in `/etc/foundry-mail/secrets.env`

## Notes
- No monitor probe yet on foundry-srv.
- No AGM backup pull yet.
- nginx on foundry-srv only routes port 80 → docs (blue). Mail client accessible on port 3004 directly.
