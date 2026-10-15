# Weather Window

Mobile-first tracker for a **30-minute rain-free shopping round trip**. Choose a map pin, use your device location, or search an Australian suburb/postcode. Save the starting point locally and request a one-shot alert when a dry window opens.

**Live BOM weather is not connected.** The app includes a clearly labelled simulated demo and a gateway contract for an approved BOM short-range forecast. It does not scrape BOM, extrapolate radar history, or substitute another weather provider. Map and postcode lookup are live OpenStreetMap services.

## Run locally

Requires Node.js 24+ and pnpm 11.

```sh
cd ~/src/weather-window
pnpm install
pnpm dev
```

Checkout moved from `~/.t3/projects/src-weather-window` to `~/src/weather-window`. Source paths are relative. When moving a checkout, install dependencies in the new location rather than copying `node_modules`; generated pnpm launchers can retain absolute paths to the old checkout.

Open http://localhost:5173. Choose a point, or select **Try demo forecast** to explore dry/rainy scenarios and demo alerts. The **Use map centre** button provides a keyboard alternative to clicking the map. Arrow keys pan the focused map.

```sh
pnpm check
pnpm test
pnpm build
pnpm start
```

`pnpm start` serves the production build and API on loopback. Stop the dev server first, or set another `PORT`. Tests start a temporary loopback server and need permission to bind a local port in restricted environments.

## Alert behavior

- Require 30 continuous future minutes, forecast rain amount zero, and rain chance ≤20% throughout. Five-minute intervals or finer only.
- Forecast issuance must be at most 15 minutes old, at most one minute in the future, and represent the selected point within 250 metres. Gaps, missing values, coarse intervals, and invalid feeds cannot issue a dry alert.
- Poll the configured feed every minute; recheck freshness every 15 seconds. A watch sends one alert, then stops. Changing location or leaving demo stops the watch.
- Alerts work **while the page stays open**. Browser scheduling can pause background tabs. If notification permission is denied or the browser rejects desktop notifications, the app shows an in-page alert. Closed-app push, SMS, and email are not implemented. OS notification delivery has not been verified.
- Estimates concern the starting point, not the shopping route. A low-risk forecast is not a guarantee of dry weather.

## Connect BOM data

See [feed contract and setup](docs/bom-feed.md). `BOM_NOWCAST_URL` is an approved gateway you provide; it is **not** a discovered public BOM endpoint. Without it, `/api/forecast` returns HTTP 503 and live alerts remain disabled. A translator for a licensed upstream feed must be implemented against its actual schema; this repository cannot manufacture short-range information from daily/three-hour forecasts.

BOM describes its 90-minute nowcast as app-only, unavailable in web radar. Its supported public products have different time resolutions. See [BOM radar/nowcast availability](https://www.bom.gov.au/news-and-media/explore-our-rain-radar-and-weather-maps), [ADFD guide](https://www.bom.gov.au/catalogue/adfdUserGuide.pdf), and [data access terms](https://www.bom.gov.au/catalogue/anon-ftp.shtml).

## Privacy and external services

The selected point is saved only in this browser’s local storage. Watches are session-only. Device location is requested only when **Use my location** is clicked. Chosen coordinates go to the configured forecast gateway. Submitted searches go to OpenStreetMap Nominatim through the local API; map tiles go directly to OpenStreetMap. No search autocomplete; the server caps geocoder requests at one per second and caches results. Fonts load from Google Fonts with system fallbacks. All forecast tokens stay server-side in ignored `.env` files.

## Delivery status

See [contributing and jj workflow](CONTRIBUTING.md) for checkout setup, ignored local files, validation, and pull requests.

TypeScript app, map selection, postcode lookup, demo, alert engine, validation, and local production server implemented. Live BOM feed/licensing and closed-app notifications remain outside verified functionality. GitHub origin is `michft/weather-window`; [PR body](docs/PR.md) covers the app and relocated checkout setup for review against `main`.
