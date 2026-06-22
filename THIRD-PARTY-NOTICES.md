# Third-Party Notices

Foundry is licensed under **AGPL-3.0** (see `LICENSE`). It builds on open-source
software whose licenses and copyrights are retained by their respective authors.

## Primary frameworks (permissive)
- **Next.js** — MIT (Vercel)
- **React** — MIT (Meta)
- **Tailwind CSS** — MIT
- **postgres.js** — Unlicense
- **Turborepo** — MPL-2.0

The complete dependency tree and its licenses can be generated from the lockfile:

```bash
pnpm licenses list
```

## Notable components for the PDF app
The PDF app (`apps/pdf`) is a UI client; its document processing is performed by the
separate **`foundry-pdf-proc`** service (its own repository), which is **AGPL-3.0** and
built on:
- **PyMuPDF / MuPDF** — **AGPL-3.0** (Artifex; commercial licensing available). This is
  the reason the PDF processing tier is copyleft.
- **pdf2docx** — MIT
- **pyHanko** (e-signatures) — MIT

Document format conversion invokes **LibreOffice** (MPL-2.0 / LGPL-3.0) as a separate
process (not linked into Foundry).

## Attribution
Each dependency's full license text is available in its source distribution and is
retained as required. If you believe an attribution is missing or incorrect, please open
an issue.
