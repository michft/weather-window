## Summary

Add Weather Window: choose a map pin or postcode, then watch for 30 continuous dry minutes for a shopping round trip.

```text
map pin / postcode → starting point
approved BOM gateway → validate → 30-minute dry window → one-shot alert
labelled demo → same window assessment → demo alert
```

No live BOM short-range feed is configured. Gateway contract and honest unavailable state included; live operation requires approved data and a source-specific translator. Alerts require the page open; closed-app push is not implemented.

## Evidence

- **Before:** README/icon only; no tracker or application scripts.
  **After:** `pnpm build` checks TypeScript and produces production assets. `pnpm test` checks dry-window boundaries, missing/coarse/stale feeds, location mismatches, and malformed HTTP requests.
- **Before:** no map/search or alert UI.
  **After:** browser checks cover map selection, live postcode lookup, demo dry/rainy windows, denied-notification fallback, and 390px layout without horizontal overflow. OS notification delivery and live BOM forecast not verified.

## Merge Danger

**Door:** two-way

New local app; no data migrations or remote deployment. Remove the feature to roll back. Saved starting point stays in browser storage.

**Blast Radius:** local

External map/geocoder availability affects location services. Live weather depends on an approved configured feed. Missing or invalid forecasts block alerts.
