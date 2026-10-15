# Glossary

- **Starting point:** selected map coordinate where weather is evaluated. Not a route forecast.
- **Postcode:** search input locating an Australian postal area; multiple results require explicit selection.
- **Shopping trip:** 30-minute round trip, including shopping and return travel.
- **Dry window:** continuous forecast period with zero forecast rain amount and at most 20% rain chance, long enough for the full shopping trip. An estimate, not a guarantee.
- **Watch:** one-shot session request to alert when a qualifying window is open at the chosen starting point.
- **Nowcast:** short-range future weather forecast. Distinct from historical radar observations.
- **Radar:** observed rain location/history; not sufficient to establish a future dry window by itself.
- **BOM gateway:** operator-configured approved source/translator implementing the documented point forecast contract. No public minutely endpoint is assumed.
- **Demo:** simulated rain forecast clearly labelled throughout. Never evidence of live BOM data.
- **Browser alert:** in-page message plus permitted browser notification while the page runs. Distinct from closed-app push.
