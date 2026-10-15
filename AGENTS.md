# Weather Window agent guidance

- Use pnpm (pinned in `package.json`), Node.js 24+, TypeScript, and existing patterns.
- Prefer jj for version control in this colocated repository. Inspect `jj status` before editing; preserve existing changes. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for setup and task workflow.
- Before finishing, describe the task change with `jj describe`, point a concise task bookmark at it, and report `jj status`. Publish only within the user's authorized scope; open a PR for requested changes. Never merge without instruction.
- Validate changed code with `pnpm check`, `pnpm test`, and `pnpm build` as appropriate. `pnpm test` needs loopback access. Use `git diff --check` for whitespace validation; jj 0.46 has no equivalent option.
- Keep source paths relative to the checkout. Do not track `.jj`, dependencies, build output, local caches, or `.env` secrets. Keep `.env.example` and `pnpm-lock.yaml` tracked.
- Keep mobile-first, accessible UI and the product meanings in [GLOSSARY.md](GLOSSARY.md). Demo forecasts stay explicitly simulated; missing or invalid live data must not enable dry-window alerts. Page-open alerts are distinct from closed-app push.
- Update setup/behavior docs and `CHANGELOG.md` when relevant. Record verification limits honestly; a local HTTP smoke test does not prove live BOM data, OS notification delivery, or physical-device behavior.
