## Summary

Add Weather Window: choose a map pin or postcode, then watch for 30 continuous dry minutes for a shopping round trip.

```text
map pin / postcode → starting point
approved BOM gateway → validate → 30-minute dry window → one-shot alert
labelled demo → same window assessment → demo alert
```

Checkout now lives at `~/src/weather-window`, moved from `~/.t3/projects/src-weather-window`. Setup documents reinstalling dependencies after a move so generated pnpm launchers use the current path. Application source paths are relative.

No live BOM short-range feed is configured. Gateway contract and honest unavailable state included; live operation requires approved data and a source-specific translator. Alerts require the page open; closed-app push is not implemented.

## Evidence

- **Before:** README/icon only; no tracker or application scripts.
  **After:** `pnpm build` checks TypeScript and produces production assets. `pnpm test` checks dry-window boundaries, missing/coarse/stale feeds, location mismatches, and malformed HTTP requests.
- **Before:** no map/search or alert UI.
  **After:** browser checks cover map selection, live postcode lookup, demo dry/rainy windows, denied-notification fallback, and 390px layout without horizontal overflow. OS notification delivery and live BOM forecast not verified.
- After relocation, `pnpm build` passed, `pnpm test` passed all 3 tests with loopback permission, and dev/production smoke checks returned HTTP 200 for the page and referenced script. Generated dependencies and production output contain no old absolute checkout paths. Full browser coverage above is recorded in `docs/validation.md`; it was not repeated for the documentation-only relocation.
- `git diff --check` passed. Initial sandbox test run could not bind localhost (`EPERM`); rerun with loopback permission passed. Clean dependency install hit missing offline packages and registry DNS failure; original dependencies were restored and generated launchers refreshed, with no lockfile changes.

## Merge Danger

**Door:** two-way

New local app; no data migrations or remote deployment. Remove the feature to roll back. Saved starting point stays in browser storage.

**Blast Radius:** local

External map/geocoder availability affects location services. Live weather depends on an approved configured feed. Missing or invalid forecasts block alerts.
