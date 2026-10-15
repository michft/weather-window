# Contributing

Use Node.js 24+, pnpm 11, and Jujutsu (`jj`). GitHub pull requests use the colocated Git repository. Commands below match jj 0.46.0.

## Checkout

For a fresh checkout:

```sh
jj git clone --colocate https://github.com/michft/weather-window.git weather-window
cd weather-window
```

For an existing Git checkout, run `jj git init --colocate` once if `.jj` is absent. Keep existing changes; initialization does not require resetting or cleaning the checkout. Never copy `.jj` from another checkout.

Configure this checkout's trunk and push remote:

```sh
jj config set --repo 'revset-aliases."trunk()"' 'main@origin'
jj config set --repo git.push origin
jj git fetch --remote origin
jj bookmark track main@origin
pnpm install --frozen-lockfile
```

Repo-specific jj configuration stays in ignored `.jj` metadata; repeat configuration for each fresh checkout. After moving a checkout, install dependencies in the new location. Copied `node_modules` can retain old absolute paths in generated launchers.

## Make a change

Inspect existing work first. Start a new task from the fetched trunk only when ready to leave the current change:

```sh
jj status
jj new main@origin
jj describe -m "Describe the change"
jj bookmark create task-name -r @
```

Replace `task-name` with a concise, unique name. Edit files normally; jj snapshots them automatically. No staging step is required. Keep scope narrow, update setup/behavior docs and `CHANGELOG.md`, and update `GLOSSARY.md` when product concepts change.

Before publishing:

```sh
pnpm check
pnpm test
pnpm build
git diff --check
jj diff
jj status
jj bookmark set task-name -r @
```

Tests bind an ephemeral loopback port. A restricted sandbox may need permission for this; a bind failure does not establish an application regression.

Git is used only for the whitespace check because jj 0.46 has no `diff --check` option. Use jj for change descriptions, bookmarks, fetching, and pushing.

Publish the selected bookmark and open a PR against `main` when authorized:

```sh
jj git push --remote origin --bookmark task-name
gh pr create --repo michft/weather-window --base main --head task-name --title "Describe the change" --body-file /path/to/pr-body.md
```

Write a task-specific PR body with summary, verification evidence, and merge risks. `docs/PR.md` describes the initial app delivery; replace that content for subsequent tasks rather than reusing unrelated evidence. Review the exact diff and do not merge automatically.

For later edits after publishing, use `jj new task-name` to add a follow-up commit, then move the bookmark to `@` and push again. Avoid rewriting published commits unless explicitly agreed.

## Local files and secrets

Copy `.env.example` to `.env` only when configuring an approved BOM gateway. `.env` variants, dependencies, build output, pnpm cache, and jj metadata are ignored. `.env.example` and `pnpm-lock.yaml` stay tracked. Never put forecast credentials in `VITE_*` variables or commit real tokens.

Live BOM setup and current verification limits are documented in [the feed contract](docs/bom-feed.md) and [validation notes](docs/validation.md).
