# Foundry

A self-hosted, open-source productivity suite — built for modern software stacks.

**Foundry** gives you a word processor, a spreadsheet, and email with calendar, all running on your own server. Your data stays on your infrastructure, under your control.

## Apps

| App | Description | Dev port |
|---|---|---|
| `docs` | Word processor with real-time collaboration | 3001 |
| `sheets` | Spreadsheet with Python scripting | 3002 |
| `mail` | Email + calendar backed by Stalwart Mail | 3003 |

## Why Foundry

- **Self-hosted** — your data stays on your server, always
- **Open source** — AGPL-3.0; fork it, improve it, contribute back
- **Python scripting** — Python in Sheets gives you a real ecosystem for data work: pandas, numpy, and more
- **Modern stack** — built from scratch on Next.js and TypeScript; no legacy debt
- **Own your mail** — Stalwart Mail (AGPL, Rust) handles SMTP/IMAP/JMAP/CalDAV on your own server

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+

### Install dependencies

```bash
pnpm install
```

### Development

```bash
# Start all three apps simultaneously
pnpm dev

# Start a single app
pnpm dev:docs
pnpm dev:sheets
pnpm dev:mail
```

### Environment

Each app has its own `.env.local`. Copy the example files:

```bash
cp apps/docs/.env.example apps/docs/.env.local
cp apps/sheets/.env.example apps/sheets/.env.local
cp apps/mail/.env.example apps/mail/.env.local
```

## Architecture

```
apps/
  docs/     Next.js — word processor (TipTap editor, .docx import/export)
  sheets/   Next.js — spreadsheet (HyperFormula, Python via Pyodide, .xlsx)
  mail/     Next.js — email + calendar (JMAP client for Stalwart Mail)
packages/
  shared/   Shared TypeScript types and utilities
  ui/       Shared component library
```

## Self-Hosting

Each Foundry deployment runs on a single server:
1. A PostgreSQL database (Docs + Sheets)
2. Stalwart Mail server (Mail app backend)
3. The three Next.js apps (served via nginx)

See `docs/self-hosting.md` for the full deployment guide.

## Mail Server

Foundry Mail uses [Stalwart Mail](https://stalw.art) as its backend — an open-source SMTP/IMAP/JMAP/CalDAV server written in Rust. Each self-hosted deployment gets its own Stalwart instance, so every organization's email stays on their own server.

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) for the full text.

## Contributing

Foundry is an open-source project. Contributions, bug reports, and feature requests are welcome.
