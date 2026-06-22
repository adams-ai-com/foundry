# Contributing to Foundry

Thanks for your interest in Foundry. This project is **AGPL-3.0** licensed, self-hosted-first, and built in the open.

## Ways to contribute
- **Bugs / features:** open an issue with clear reproduction steps or a focused proposal.
- **Code:** fork, branch, and open a pull request against `main`. Keep PRs scoped to one change.
- **Docs:** improvements to setup, self-hosting, and the wiki are very welcome.

## Developer Certificate of Origin (DCO)
Contributions are accepted under the **DCO 1.1** — by signing off, you certify you wrote the code (or have the right to submit it) under the project's license. Add a `Signed-off-by` line to each commit:

```
git commit -s -m "your message"
```

(We use the lightweight DCO rather than a CLA: Foundry's core stays AGPL-3.0 and is never relicensed, so no copyright assignment is needed.)

## Development
```bash
pnpm install
# copy each app's .env.example to .env and fill in values
pnpm dev          # or per-app: pnpm --filter @foundry/<app> dev
```
- Monorepo: pnpm workspaces + Turborepo. Apps live under `apps/`, shared code under `packages/`.
- Run `pnpm lint` and `pnpm build` before opening a PR.
- **Never commit secrets.** Only `.env.example` (placeholders) belongs in git. CI runs a secret scan (gitleaks) on every PR.

## Code style
Match the surrounding code. TypeScript throughout; keep changes minimal and idiomatic.

## License
By contributing, you agree your contributions are licensed under **AGPL-3.0**.
