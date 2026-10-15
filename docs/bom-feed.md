# Approved BOM short-range feed

This is a **gateway contract**, not BOM's native API schema. No public minutely BOM endpoint was verified. An approved/licensed source and a translator to this schema are prerequisites for live tracking. Do not split daily/hourly/three-hour rain totals into five-minute samples or relabel historical radar as forecast.

## Configuration

Copy `.env.example` to `.env`. Configure an HTTPS `BOM_NOWCAST_URL` for your own approved gateway and optionally `BOM_NOWCAST_TOKEN`. Restart the server after changing configuration. Never use browser-exposed `VITE_*` variables for secrets. The gateway URL is server configuration, not visitor input; redirects are rejected so bearer tokens cannot follow them.

The local server sends:

```http
GET https://your-approved-gateway.example/nowcast?lat=-33.8688&lon=151.2093
Accept: application/json
Authorization: Bearer <optional server-side token>
```

The gateway returns JSON:

```json
{
  "source": "BOM",
  "issuedAt": "2026-10-15T03:00:00Z",
  "point": { "lat": -33.8688, "lon": 151.2093 },
  "intervals": [
    {
      "start": "2026-10-15T03:00:00Z",
      "end": "2026-10-15T03:05:00Z",
      "rainMm": 0,
      "rainChance": 10
    }
  ]
}
```

The example shows one interval only and deliberately does **not** qualify as a full shopping window. Return contiguous samples covering now through at least 30 minutes; 90 minutes populates the whole timeline. Timestamps must include timezone. Rain amount is millimetres **over that interval**; rain chance is 0–100 percent for the same interval. Missing/unknown values must not become zero.

Validation:

- `source` must be `BOM`; the configured gateway remains the trusted provenance boundary. A label alone does not authenticate data.
- Up to 120 intervals, ordered and non-overlapping, each longer than zero and at most five minutes. Gaps cannot qualify as dry coverage.
- Rain amount finite and nonnegative; rain chance finite and within 0–100.
- Selected point must be represented within 250 metres. The gateway must sample the selected point honestly; do not relabel an unrelated nearby station.
- Issuance at most 15 minutes old, at most one minute ahead of local clock. Supply actual issuance time, never request time. Correct client clock is required.
- HTTPS, ten-second fetch timeout, no redirects. The app does not forward upstream error bodies or credentials to the browser.

Daily/three-hour forecasts are intentionally rejected. If an approved feed cannot supply the required resolution/uncertainty, keep live alerts unavailable or explicitly redesign the product with the user.

## Sources checked 15 October 2026

- [BOM radar/nowcast explanation](https://www.bom.gov.au/news-and-media/explore-our-rain-radar-and-weather-maps): app nowcast, web limitations.
- [ADFD technical guide](https://www.bom.gov.au/catalogue/adfdUserGuide.pdf): registered feed formats and forecast periods.
- [Weather data services](https://www.bom.gov.au/catalogue/data-feeds.shtml): supported delivery channels.
- [Anonymous FTP terms](https://www.bom.gov.au/catalogue/anon-ftp.shtml) and [copyright](https://www.bom.gov.au/copyright): review licensing before redistribution or commercial use.

No live BOM short-range response was obtained or verified. No scraping bypasses, extracted private keys, or fallback weather providers are included.
