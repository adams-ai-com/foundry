# Foundry (Unified Open-Source Workspace)

pnpm monorepo (Turborepo). AGPL-licensed open-source workspace replacing MS 365 / Google Workspace: Mail (our own server), Docs, Sheets, Channels, Files, Wiki, Tasks, Decisions. Workspace-first architecture. AI-native. Adams AI manages self-hosted instances for verticals. Working copy lives here on the control box; running on foundry-srv.

## Remote host
- **Server**: foundry-srv `142.93.61.78`
- **SSH**: `sudo -u manager ssh -n -i ~manager/.ssh/id_ed25519 manager@142.93.61.78 '<cmd>'`
- **Repo on server**: cloned to `/var/www/foundry` as `foundry` unix user from `github.com/adams-ai-com/foundry`

## Monorepo layout
- `apps/docs` — Foundry Docs (word processor)
- `apps/sheets` — Foundry Sheets (spreadsheets, not yet built)
- `apps/mail` — Foundry Mail client (Next.js, scaffold exists — needs rewiring to our own mailserver)
- `services/mailserver` — Foundry Mail server (Node.js, not yet built — our own SMTP + storage + REST API)
- `packages/` — shared libs

## Blue-green deployment (Docs)
- Blue port: **3001** (currently live), Green port: 4001
- Slot state: `/etc/adams/slots/foundry-docs` on server
- Service units: `foundry-docs-blue.service`, `foundry-docs-green.service`
- WorkingDirectory: `/var/www/foundry-blue/apps/docs` (ExecStart: `node apps/docs/server.js`)
- Slot dirs: `/var/www/foundry-blue/`, `/var/www/foundry-green/`
- Secrets: `/etc/foundry-docs/secrets.env` on server

## Databases
- PG on foundry-srv: `foundry_docs`, `foundry_sheets`, `foundry_mail` (owner: `foundry`)

## Deploy pattern
Build on control box with pnpm, then scp the app's standalone output to the standby slot on the server.

## Notes
- No monitor probe yet on foundry-srv.
- No AGM backup pull yet.
- Sheets + Mail services not yet built.
