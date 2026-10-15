## Summary

Document the checkout relocation and how to avoid stale generated dependency paths.

```diff
- ~/.t3/projects/src-weather-window
+ ~/src/weather-window
```

Source paths already resolve relative to the checkout. Local generated pnpm launchers were refreshed; dependency files remain ignored.

## Evidence

- **Before:** generated dependency launchers referenced the old checkout.
  **After:** `pnpm rebuild` refreshed top-level launchers; the old prefix was replaced in six remaining nested launchers. Recursive scan found no old absolute checkout paths in `node_modules` or `dist`.
- `pnpm build`: TypeScript and production build passed.
- `pnpm test`: all 3 tests passed with loopback permission. Initial sandbox run failed because binding localhost returned `EPERM`.
- Dev and production smoke checks: page and referenced script returned HTTP 200 from the new checkout.
- Clean offline install lacked cached packages; online install hit registry `ENOTFOUND`. Original dependencies were restored before refreshing launchers. Lockfile unchanged.
- `git diff --check`: passed.

## Merge Danger

**Door:** two-way

Documentation only; no application behavior or dependency version changes.

**Blast Radius:** local
