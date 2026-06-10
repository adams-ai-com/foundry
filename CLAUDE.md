# Foundry (Unified Open-Source Workspace)

pnpm monorepo (Turborepo). AGPL-licensed open-source workspace replacing MS 365 / Google Workspace: Mail (our own server), Docs, Sheets, Channels, Files, Wiki, Tasks, Decisions. Workspace-first architecture. AI-native. Adams AI manages self-hosted instances for verticals. Working copy lives here on the control box; running on foundry-srv.

## Remote host
- **Server**: foundry-srv `142.93.61.78`
- **SSH**: `sudo -u manager ssh -n -i ~manager/.ssh/id_ed25519 manager@142.93.61.78 '<cmd>'`
- **Repo on server**: cloned to `/var/www/foundry` as `foundry` unix user from `github.com/adams-ai-com/foundry`

## Deploying — ALWAYS use foundry-deploy (e2e gate on every deploy)

```
sudo /usr/local/bin/foundry-deploy <app>   # on foundry-srv
# apps: workspace docs sheets mail mailserver wiki channels sites pdf pdf-proc
```

One command = build -> systemctl restart -> FULL e2e verification (e2e-suite
61 tests across all apps + the 28-test PDF deep suite). Exit nonzero means
the deploy did NOT verify — fix or roll back before walking away. Log at
/var/log/foundry-deploy.log. Canonical script: scripts/foundry-deploy
(git-tracked); installed copy: /usr/local/bin/foundry-deploy.

Do NOT hand-roll pnpm build + systemctl restart anymore — that skips the gate.
Tests live in e2e-suite/ (all apps) and apps/pdf/e2e/ (PDF deep); shared
helpers in packages/e2e. Run suites standalone:
`cd /var/www/foundry/e2e-suite && ./node_modules/.bin/playwright test`
(as foundry, HOME=/home/foundry).

## Monorepo layout
- `apps/workspace` — Auth shell: magic-link login, org management, app launcher (port 3000) ← **entry point**
- `apps/docs` — Foundry Docs (word processor, port 3001)
- `apps/sheets` — Foundry Sheets (spreadsheets, port 3003)
- `apps/mail` — Foundry Mail client (Next.js, port 3004, proxies to mailserver)
- `apps/wiki` — Foundry Wiki (knowledge base, port 3005)
- `apps/sites` — Foundry Sites (CMS, port 3007)
- `apps/channels` — Foundry Channels (real-time chat + video + AI memory, port 3008) ← C15a live
- `apps/pdf` — Foundry PDF (PDF editing, forms, conversion, redaction, port 3009) ← P1 live
- `services/mailserver` — Foundry Mail server (Node.js, port 3100, REST API + SMTP)
- `packages/` — shared libs

## Public URL
`https://foundry.adams-ai.com` → nginx → workspace shell at port 3000.
nginx routes: `/pdf`→3009, `/docs`→3001, `/sheets`→3003, `/mail`→3004, `/wiki`→3005, `/sites`→3007, `/channels`→3008, `/import`→3008, `/api/import`→3008, `/api/sse`→3008 (no buffering), `/org`→3008, `/`→3000.
Cloudflare proxied (free TLS). Self-signed origin cert at `/etc/ssl/certs/foundry-origin.crt`.

## Services on foundry-srv

| Service | Unit | Port | Secrets |
|---|---|---|---|
| Workspace | `foundry-workspace.service` | 3000 | `/var/www/foundry/apps/workspace/.env` |
| Docs | `foundry-docs.service` | 3001 | `/var/www/foundry/apps/docs/.env` |
| Sheets | `foundry-sheets.service` | 3003 | `/var/www/foundry/apps/sheets/.env` |
| Mail client | `foundry-mail-client.service` | 3004 | `/var/www/foundry/apps/mail/.env` |
| Wiki | `foundry-wiki.service` | 3005 | `/var/www/foundry/apps/wiki/.env` |
| Sites | `foundry-sites.service` | 3007 | `/var/www/foundry/apps/sites/.env` |
| Channels | `foundry-channels.service` | 3008 | `/var/www/foundry/apps/channels/.env` |
| PDF | `foundry-pdf.service` | 3009 | `/var/www/foundry/apps/pdf/.env` |
| PDF proc | `foundry-pdf-proc.service` | 3200 (localhost) | `/etc/foundry/pdf-proc.env` (640 root:foundry) |
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
- Rebuild mail client: `cd /var/www/foundry && sudo -u foundry pnpm --filter @foundry/mail build` then restart `foundry-mail-client.service`
- Rebuild mailserver: `sudo -u foundry npm run build --prefix /var/www/foundry/services/mailserver`

## Testing
- **Mailserver integration tests (74 tests)**: Must inject DATABASE_URL since no .env in mailserver dir
  ```bash
  sudo -u foundry env -i PATH="$PATH" DATABASE_URL=$(sudo grep "DATABASE_URL" /etc/foundry-mail/secrets.env | cut -d= -f2-) bash -c "cd /var/www/foundry/services/mailserver && pnpm run test"
  ```
- **Mail client E2E tests (32 tests, Playwright/Chromium)**:
  - Playwright binaries at `/home/manager/.cache/ms-playwright/`; run as `manager` user
  - Requires session `e2e-test-session-fixed` in `foundry_workspace` DB (already created)
  - Global setup verifies mailserver health at `localhost:3100/health`
  ```bash
  cd /var/www/foundry/apps/mail
  MAIL_BASE_URL=http://localhost:3004 MAILSERVER_HEALTH_URL=http://localhost:3100/health PLAYWRIGHT_BROWSERS_PATH=/home/manager/.cache/ms-playwright ./node_modules/.bin/playwright test --reporter=list
  ```

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

## Channels app notes
- DB: `foundry_channels` on foundry-srv; migrate with `psql "$CHANNELS_DB_URL" -f apps/channels/scripts/migrate.sql` (+ migrate-c2.sql through c8.sql sequentially)
- VAPID keys in `/var/www/foundry/apps/channels/.env` (3 VAPID-related vars)
- Push endpoint: `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`
- Service worker: `/sw.js` (must be in `apps/channels/public/sw.js` on server — restore with `sudo -u foundry git -C /var/www/foundry restore apps/channels/` if deleted)
- C15b (Expo native app) is next — requires Apple Developer Program enrollment first

## What's next (pick up here)
C15b — Expo native app (App Store path). Prerequisites: Apple Developer Program enrollment ($99/yr). Next phases after that: C16 (mobile video).

For auth/workspace:
1. **Test auth flow**: go to `https://foundry.adams-ai.com`, enter email, grab magic link from `journalctl -u foundry-workspace | grep "MAGIC LINK"`, create org, verify launcher
2. **Wire SMTP**: set `SMTP_HOST/PORT/USER/PASS/FROM` in `/var/www/foundry/apps/workspace/.env`
