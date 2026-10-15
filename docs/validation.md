# Validation — 15 October 2026

## Automated

- `pnpm build`: strict TypeScript check and Vite production build passed.
- `pnpm test`: 3 tests passed. Covers exact 30-minute boundary; 29:59 rejection; current/future dry windows; stale/future issuance; point mismatch; missing, overlapping, coarse, or invalid intervals; rain amount/chance threshold; timeline buckets spanning intervals; malformed URL response and server survival; invalid points; HTTP 503 without a feed; unknown API routes and unsupported methods.
- `git diff --check`: passed before commit.

## Browser

Production build served on loopback. T3 collaborative browser verified:

- OpenStreetMap tiles loaded; map-centre selection updates pin, selected coordinates, and browser storage.
- Search `2000` returns `2000, Sydney, New South Wales, Australia`; explicit result selection updates the starting point.
- Missing BOM configuration produces unavailable state, 18 unknown timeline intervals, and disabled alert button.
- Demo dry scenario enables the alert button; alternate rainy scenario shows a window in ten minutes.
- In-page demo alert appears with notification permission stubbed to denied.
- With browser notification API stubbed to granted and clock advanced ten minutes, watch transitions from waiting to ready, invokes exactly one notification labelled **Demo**, then disarms. This verifies notification invocation, not OS delivery.
- Exiting demo preserves the explicitly selected location and returns to live unavailable/disabled state. Demo weather does not become live weather.
- At 390px, document width equals viewport width; all panels remain within viewport.
- Essential forecast/alert text contrast raised after review. Malformed URL crash corrected and covered by HTTP regression.

## Limits and resolved setup failures

No approved live BOM short-range feed connected or verified. No OS notification delivery, physical mobile device, or closed-app push tested. Geolocation permission flow not exercised against a real device.

Initial dev server failed with sandbox `EPERM`; rerun with local server permission succeeded. Prettier cannot parse `.env.example`; format run narrowed to supported source/docs and passed. Browser actions targeting demo controls after a development reload timed out; repeated against final production UI succeeded. Switching from dev to production reused cached dev HTML once; cache-busting navigation verified production assets, and production server now sends `Cache-Control: no-cache`. One asynchronous browser evaluation exceeded the tool's 15-second limit; subsequent state inspection confirmed the expected one-shot notification.
