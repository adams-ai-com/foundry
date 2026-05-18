# Foundry

**A unified, self-hosted, open-source workspace for the world.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](LICENSE)
[![Built with AI](https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet)](https://claude.ai/code)
[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-green)]()

---

## The Vision

Billions of people depend on software they don't own, running on servers they don't control, built by organizations whose interests don't align with theirs. The documents they write, the emails they send, the meetings they schedule — all of it flows through systems that can read it, analyze it, sell access to it, or simply shut it down.

This is not inevitable. It is a choice — and we are making a different one.

Foundry is a complete productivity workspace: email, calendar, documents, spreadsheets, team communication, file storage, and knowledge management — all running on your server, under your control, free and open source forever. Not a collection of apps bolted together. One coherent system, designed from the ground up to work as a whole.

We believe software that people depend on for work and communication is too important to leave in the hands of any single corporation. It belongs to everyone. That is why every line of Foundry's code is published here, auditable by anyone, forkable by anyone, permanent regardless of what any company decides.

---

## Built With AI, For Humanity

Foundry is developed using AI-assisted engineering — built with [Claude Code](https://claude.ai/code), Anthropic's AI coding tool. This is not incidental. It reflects a core belief: that AI should be used to build things that benefit humanity broadly, not just to increase the productivity of those who already have the most.

AI-assisted development means a small team can build software of a quality and completeness that would otherwise require an organization many times larger. That leverage exists to serve a mission: putting professional-grade, privacy-respecting productivity software in the hands of anyone who needs it — regardless of budget, geography, or organization size.

Foundry is also AI-native as a product. AI is not a feature added after the fact. The workspace is designed from day one for AI comprehension: a unified data model across all surfaces, a decisions log that captures outcomes rather than letting them drown in conversation history, and full-text search that spans everything. The result is a workspace where AI can genuinely answer "what did we decide about this project?" — not just draft a reply to an email.

---

## What We're Building

Current productivity software has several deep structural problems — not the fault of any particular organization, but the result of decades of products built separately and connected later:

- **Fragmented context.** Email lives in one application, documents in another, conversations in a third. A project's history is scattered across tools that share a login but not a data model.
- **Decisions that disappear.** When a decision is made in a chat thread or a meeting, it evaporates. There is no system that captures outcomes as searchable, permanent records.
- **Data you don't own.** For most organizations, the practical choice is between a handful of hosted services. Self-hosting — running your own infrastructure, on your own terms — has been technically possible but practically difficult.
- **AI as an afterthought.** Recent AI additions to existing tools are overlaid on architectures that predate them. They can draft text but cannot reason across the full context of your work.
- **Access as a function of price.** The best productivity software carries per-seat licensing costs that put it out of reach for schools, nonprofits, small organizations, and most of the world.

Foundry addresses all of these — not by patching existing software, but by starting clean.

### The Workspace Model

Everything in Foundry is organized around **workspaces** — a project, a team, a customer relationship. Within a workspace, every surface shares the same data model:

| Surface | Replaces |
|---|---|
| **Mail** — email + calendar, our own server | Outlook / Exchange |
| **Channels** — internal real-time communication | Teams / Slack |
| **Docs** — rich text editor, .docx compatible | Word |
| **Sheets** — spreadsheet + Python scripting | Excel |
| **Files** — versioned file storage, any format | OneDrive / Drive |
| **Wiki** — structured knowledge, company intranet | SharePoint |
| **Tasks** — action items linked to conversations | Planner / Asana |
| **Decisions** — explicit outcomes, searchable forever | (nothing — this is new) |

One search across all of it. One AI context across all of it. No switching between applications to find something that happened last month.

**Deployment is modular.** Install just Mail, just Docs, or the full workspace. Each surface is independently useful and independently deployable.

---

## Current Status

Foundry is in active development. Here is where each surface stands:

| Surface | Status |
|---|---|
| Docs | ✅ Live — rich text editor, save/load, .docx round-trip |
| Sheets | ✅ Live — spreadsheet grid, HyperFormula engine, Python scripting |
| Mail | ✅ Live — our own mail server (SMTP + REST API), inbox, threads, compose, calendar, contacts, full-text search |
| Channels | 📋 Planned — shares Mail's protocol-agnostic message model |
| Files | 📋 Planned — mail attachments already seed this table |
| Wiki | 📋 Planned — built on the Docs editor |
| Tasks + Decisions | 📋 Schema live in the Mail DB, UI planned |

This is honest: Foundry is not finished. The three core surfaces are live. The rest is being built in the open because we believe the community that will use it should be part of building it.

---

## Document Compatibility

Foundry uses a two-layer approach to document fidelity:

**Layer 1 — native JavaScript** handles everyday documents: standard business letters, proposals, reports, typical spreadsheets. Fast, no external dependencies.

**Layer 2 — LibreOffice headless** handles complex documents: tracked changes, embedded charts, multi-section layouts, legacy formats. We run LibreOffice as a server-side conversion service and gratefully credit The Document Foundation for two decades of Microsoft format compatibility work that we build on. LibreOffice is licensed under MPL-2.0 + LGPLv3+.

---

## Self-Hosting

Foundry runs on any Linux server with Node.js 20+ and PostgreSQL 16+. A standard deployment for a small organization requires 2 GB RAM.

```bash
# Clone and install
git clone https://github.com/adams-ai-com/foundry
cd foundry
pnpm install

# Configure apps
cp apps/docs/.env.example apps/docs/.env.local
cp apps/sheets/.env.example apps/sheets/.env.local
cp apps/mail/.env.example apps/mail/.env.local      # MAILSERVER_URL, MAILSERVER_API_KEY, etc.

# Configure mail server
cp services/mailserver/.env.example services/mailserver/.env
# Edit DATABASE_URL, API_KEY, MAIL_DOMAIN, SMTP_PORT

# Run migrations
pnpm --filter @foundry/mailserver db:migrate

# Run in development
pnpm dev
```

DNS setup for Mail (MX, SPF, DKIM, DMARC) is documented in `docs/mail-dns.md`.

Adams AI provides managed hosting for organizations that want the benefits of self-hosting without the operational responsibility. See [adams-ai.com](https://adams-ai.com) for details.

---

## Architecture

```
apps/
  docs/           Next.js — word processor
  sheets/         Next.js — spreadsheet
  mail/           Next.js — email + calendar client
  workspace/      Next.js — unified shell (coming)
services/
  mailserver/     Node.js — SMTP server, storage, REST API
  realtime/       Node.js — WebSocket server for channels (coming)
packages/
  shared/         TypeScript types, DB client, auth
  ui/             Shared component library
docs/             Self-hosting guide, architecture docs, contributing guide
```

---

## Contributing

Foundry exists because we believe the world deserves better than what currently exists, and that the open-source community is how better things get built.

If you share that belief, contributions are welcome — code, documentation, bug reports, design, translations, or simply using Foundry and telling us what needs to improve.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

---

## License

**GNU Affero General Public License v3.0** — see [LICENSE](LICENSE) for the full text.

AGPL-3.0 means: use it freely, modify it freely, distribute it freely — but if you run a modified version as a service, your modifications must also be open. No corporation can take this code, build a hosted product on it, and keep improvements private.

The software is free. It is free now, and it will remain free. That is not a promise — it is the license.

---

## Acknowledgements

Foundry is built on the shoulders of the open-source community:

- **LibreOffice** (The Document Foundation) — server-side document conversion
- **TipTap** / **ProseMirror** — document editor foundation
- **HyperFormula** — spreadsheet formula engine
- **Nodemailer** / **smtp-server** / **mailparser** — mail server foundation
- **Fastify** — API server framework
- The many other open-source libraries listed in `docs/acknowledgements.md`

We are grateful for their work and committed to contributing back.
