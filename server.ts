import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { isAustralianPoint, parseForecast } from "./src/weather.ts";

const production = process.argv.includes("--production");
const port = Number(process.env.PORT || 5173);
const vite = production
  ? undefined
  : await (
      await import("vite")
    ).createServer({
      server: { middlewareMode: true, hmr: { host: "127.0.0.1" } },
      appType: "spa",
    });
const root = resolve("dist");
const placesCache = new Map<string, unknown>();
let nextSearch = 0;

const server = createServer(async (req, res) => {
  let url: URL;
  try {
    url = new URL(req.url || "/", "http://localhost");
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Invalid request URL");
    return;
  }
  function json(status: number, body: unknown) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  }
  try {
    if (url.pathname.startsWith("/api/")) {
      if (req.method !== "GET") {
        json(405, { error: "Method not allowed." });
        return;
      }
      if (url.pathname === "/api/forecast") {
        const latText = url.searchParams.get("lat"),
          lonText = url.searchParams.get("lon");
        const lat = Number(latText),
          lon = Number(lonText);
        if (!latText || !lonText || !isAustralianPoint(lat, lon)) {
          json(400, { error: "Choose an Australian map location." });
          return;
        }
        if (!process.env.BOM_NOWCAST_URL) {
          json(503, {
            code: "feed_unconfigured",
            error:
              "BOM short-range feed awaiting connection. Live dry-window alerts are unavailable. Try the labelled demo.",
          });
          return;
        }
        const upstream = new URL(process.env.BOM_NOWCAST_URL);
        if (upstream.protocol !== "https:")
          throw new Error("BOM_NOWCAST_URL must use HTTPS.");
        upstream.searchParams.set("lat", String(lat));
        upstream.searchParams.set("lon", String(lon));
        const response = await fetch(upstream, {
          headers: {
            Accept: "application/json",
            ...(process.env.BOM_NOWCAST_TOKEN
              ? { Authorization: `Bearer ${process.env.BOM_NOWCAST_TOKEN}` }
              : {}),
          },
          signal: AbortSignal.timeout(10_000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("Forecast gateway unavailable.");
        // Bound responses before parsing. The configured gateway is trusted, not browser input.
        const text = await response.text();
        if (text.length > 200_000)
          throw new Error("Forecast response too large.");
        json(200, parseForecast(JSON.parse(text)));
        return;
      }
      if (url.pathname === "/api/places") {
        const query = (url.searchParams.get("q") || "").trim();
        if (query.length < 2 || query.length > 80) {
          json(400, {
            error: "Enter an Australian suburb or four-digit postcode.",
          });
          return;
        }
        if (placesCache.has(query)) {
          json(200, placesCache.get(query));
          return;
        }
        // Nominatim public policy: submitted searches only, at most one request per second.
        if (Date.now() < nextSearch) {
          json(429, { error: "Please wait a moment before searching again." });
          return;
        }
        nextSearch = Date.now() + 1100;
        const search = new URL("https://nominatim.openstreetmap.org/search");
        search.search = new URLSearchParams({
          format: "jsonv2",
          countrycodes: "au",
          limit: "5",
          addressdetails: "1",
          ...(/^\d{4}$/.test(query)
            ? { postalcode: query, country: "Australia" }
            : { q: query }),
        }).toString();
        const response = await fetch(search, {
          headers: {
            "User-Agent":
              "WeatherWindow/0.1 (Australian shopping-window location search)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
          throw new Error(
            "Location search unavailable. Choose a point on the map instead.",
          );
        const raw: unknown = await response.json();
        if (!Array.isArray(raw))
          throw new Error("Location search returned invalid data.");
        const places = raw.flatMap((item: unknown) => {
          if (
            !item ||
            typeof item !== "object" ||
            !("lat" in item) ||
            !("lon" in item) ||
            !("display_name" in item)
          )
            return [];
          const lat = Number(item.lat),
            lon = Number(item.lon);
          return isAustralianPoint(lat, lon) &&
            typeof item.display_name === "string"
            ? [{ lat, lon, name: item.display_name }]
            : [];
        });
        if (placesCache.size >= 100) placesCache.clear();
        placesCache.set(query, places);
        json(200, places);
        return;
      }
      json(404, { error: "Unknown endpoint." });
      return;
    }
    if (vite) {
      vite.middlewares(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const file = resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const mime: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    };
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
  } catch (error) {
    const message =
      url.pathname === "/api/places"
        ? "Location search unavailable. Choose a point on the map instead."
        : "BOM forecast unavailable or invalid. No dry-window alert can be issued.";
    console.error(error instanceof Error ? error.message : "Request failed");
    if (!res.headersSent) json(502, { error: message });
    else res.end();
  }
});
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(
    `Weather Window → http://localhost:${typeof address === "object" && address ? address.port : port}`,
  );
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void vite?.close();
    server.close();
  });
