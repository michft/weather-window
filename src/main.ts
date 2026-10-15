import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import {
  assess,
  bucket,
  demoForecast,
  isAustralianPoint,
  MINUTE,
  parseForecast,
} from "./weather.ts";
import type { Assessment, Forecast, Point } from "./weather.ts";

const paths: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  locate:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  rain: '<path d="M6 15a4 4 0 0 1-1-8 6 6 0 0 1 11-2 5 5 0 1 1 2 10M8 18l-1 3m6-3-1 3m6-3-1 3"/>',
};
function icon(name: string, cls = ""): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.sun}</svg>`;
}
function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
}
const savedKey = "weather-window-location-v1";
function readLocation(): Point | undefined {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(savedKey) || "null");
    if (
      saved &&
      typeof saved === "object" &&
      "lat" in saved &&
      "lon" in saved &&
      "name" in saved &&
      typeof saved.lat === "number" &&
      typeof saved.lon === "number" &&
      typeof saved.name === "string" &&
      isAustralianPoint(saved.lat, saved.lon)
    )
      return { lat: saved.lat, lon: saved.lon, name: saved.name.slice(0, 200) };
  } catch {
    /* Storage unavailable: location remains session-local. */
  }
}
let point = readLocation();
let forecast: Forecast | undefined;
let demo = false;
let rainy = false;
let watching = false;
let loading = false;
let error = "";
let requestId = 0;
let controller: AbortController | undefined;
let notificationPending = false;
const sydney: Point = {
  lat: -33.8688,
  lon: 151.2093,
  name: "Sydney · example location",
};

el("app").innerHTML = `
  <header class="masthead">
    <a href="/" class="brand" aria-label="Weather Window home"><span class="brand-mark">${icon("sun")}</span><span>weather<span class="brand-light">window</span><small>A little time to step outside.</small></span></a>
    <span class="source-pill"><span class="dot"></span><span id="source-status">BOM · not connected</span></span>
  </header>
  <main>
    <div class="page-heading"><div><p class="eyebrow">THE EVERYDAY WEATHER TRACKER</p><h1>Time for the shops?</h1><p>Find a 30-minute break in the rain, right where you are.</p></div><span class="trip-tag">${icon("bag")} A 30-minute round trip</span></div>
    <div id="mode-banner" class="mode-banner" hidden><span><strong>Demo mode</strong> · Simulated weather. Not a live BOM forecast.</span><button id="exit-demo" class="text-button">Exit demo ${icon("arrow")}</button></div>
    <div class="workspace">
      <section class="control-panel" aria-label="Shopping window tracker">
        <div class="location-section">
          <div class="section-label"><h2>01 <span>Your starting point</span></h2><span>AUSTRALIA</span></div>
          <form id="search-form" role="search"><label class="sr-only" for="search">Australian suburb or postcode</label><div class="search-box">${icon("search")}<input id="search" type="search" placeholder="Suburb or postcode" minlength="2" maxlength="80" required autocomplete="off"><button id="search-button" type="submit" aria-label="Search location">${icon("arrow")}</button></div></form>
          <p id="search-status" class="small muted" role="status"></p><ul id="search-results" class="search-results" aria-label="Location results" hidden></ul>
          <button id="locate" class="locate-button">${icon("locate")} Use my location</button>
          <div class="selected-location">${icon("pin")}<div><strong id="location-name">Pick a point on the map</strong><span id="coordinates">Or search an Australian suburb or postcode</span></div><span class="location-check" id="location-check" hidden>${icon("check")}</span></div>
        </div>
        <div class="window-section">
          <div class="section-label"><h2>02 <span>Your weather window</span></h2><span id="forecast-tag">NOT CONNECTED</span></div>
          <div id="window-card" class="window-card" data-state="unavailable">
            <div class="window-symbol" id="window-symbol">${icon("sun")}</div>
            <p id="window-kicker" class="eyebrow">LET’S FIND YOUR WINDOW</p><h3 id="window-title">Choose your spot.</h3><p id="window-message">Drop a pin to check the weather for your trip.</p>
            <div class="window-timing"><span>${icon("clock")} Trip time</span><strong>30 minutes</strong></div>
          </div>
          <button id="watch" class="primary-button" disabled>${icon("bell")} <span id="watch-label">Alert me when it’s dry</span>${icon("arrow")}</button>
          <p class="alert-note">Alerts while this page stays open. Background tabs may pause.</p>
          <p id="alert-status" class="small" role="status" aria-live="polite"></p>
        </div>
        <div class="demo-prompt"><span class="demo-icon">${icon("sun")}</span><div><strong id="demo-prompt-title">See how it works</strong><p id="demo-prompt-copy">Try a simulated break in the rain.</p></div><button id="demo" class="round-button" aria-label="Try demo forecast">${icon("arrow")}</button></div>
      </section>
      <section class="map-panel" aria-labelledby="map-heading">
        <div class="map-header"><div><h2 id="map-heading">Make it local.</h2><p>Tap the map to set your starting point.</p></div><span class="map-label">${icon("pin")} MAP LOCATION</span></div>
        <div class="map-wrap"><div id="map" aria-label="Map of Australia. Pan with arrow keys, then choose Use map centre." tabindex="0"></div><div id="map-error" class="map-error" hidden>Map tiles unavailable. Pin selection still works; use suburb or postcode search too.</div><button id="map-centre" class="map-centre">${icon("pin")} Use map centre</button><span class="map-hint">Location map · no radar overlay</span></div>
        <div class="timeline"><div class="timeline-heading"><h3>Next 90 minutes</h3><span id="timeline-caption">Awaiting forecast</span></div><div id="rain-bars" class="rain-bars" role="img" aria-label="No forecast connected"></div><div class="timeline-axis"><span>Now</span><span>+30 min</span><span>+60 min</span><span>+90 min</span></div><div class="timeline-legend"><span><i class="legend-dry"></i> No rain forecast</span><span><i class="legend-rain"></i> Rain risk</span><span><i class="legend-unknown"></i> No data</span></div></div>
      </section>
    </div>
    <section class="how-it-works" aria-label="How weather windows work"><div>${icon("pin")}<p><strong>Your spot, your forecast.</strong><span>Map pin first. Postcodes work too.</span></p></div><div>${icon("clock")}<p><strong>Enough time to get back.</strong><span>A full 30-minute dry window.</span></p></div><div>${icon("bell")}<p><strong>One window. One alert.</strong><span>Choose when you want to watch.</span></p></div></section>
    <footer><span>Weather Window <span class="footer-dot">·</span> Built for everyday errands.</span><span><a href="https://www.bom.gov.au/weather-and-climate/rain-radar-and-weather-maps" target="_blank" rel="noopener noreferrer">Check BOM radar ↗</a><button id="about" class="text-button">About the forecast</button></span></footer>
  </main>
  <dialog id="about-dialog"><button id="close-about" class="dialog-close" aria-label="Close forecast information">×</button><p class="eyebrow">ABOUT THE FORECAST</p><h2>A window, not a promise.</h2><p>A dry window needs 30 continuous minutes with no forecast rain and rain chance at most 20%, using intervals no longer than 5 minutes.</p><p>Live tracking requires an approved BOM short-range feed. None is connected by default. BOM’s public daily and three-hour rain forecasts cannot establish a 30-minute window. Demo weather is simulated.</p><p>Estimates apply to your starting point, not your whole route. Check current conditions before leaving.</p><p>Browser alerts work while this page is open; they are not closed-app push notifications. Saved location stays in this browser. Map tiles and location search use OpenStreetMap services.</p><a href="https://www.bom.gov.au/news-and-media/explore-our-rain-radar-and-weather-maps" target="_blank" rel="noopener noreferrer">BOM’s radar and nowcast availability ↗</a></dialog>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
`;

const map = L.map("map", { zoomControl: false }).setView(
  [point?.lat ?? sydney.lat, point?.lon ?? sydney.lon],
  12,
);
L.control.zoom({ position: "topright" }).addTo(map);
const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  minZoom: 3,
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
tiles.on("tileerror", () => {
  el("map-error").hidden = false;
});
const marker = L.marker([point?.lat ?? sydney.lat, point?.lon ?? sydney.lon], {
  draggable: true,
  title: "Your starting point. Drag to change location.",
  icon: L.divIcon({
    html: `<span class="pin-core">${icon("bag")}</span>`,
    className: "shopping-pin",
    iconSize: [44, 52],
    iconAnchor: [22, 48],
  }),
});
if (point) marker.addTo(map);
map.on("click", (event: L.LeafletMouseEvent) =>
  selectPoint(event.latlng.lat, event.latlng.lng),
);
marker.on("dragend", () => {
  const pos = marker.getLatLng();
  if (!isAustralianPoint(pos.lat, pos.lng) && point)
    marker.setLatLng([point.lat, point.lon]);
  selectPoint(pos.lat, pos.lng);
});
el("map-centre").addEventListener("click", () => {
  const centre = map.getCenter();
  selectPoint(centre.lat, centre.lng);
});

function selectPoint(lat: number, lon: number, name = "Your map location") {
  if (!isAustralianPoint(lat, lon)) {
    el("search-status").textContent = "Choose a location in Australia.";
    return;
  }
  point = { lat, lon, name };
  watching = false;
  notificationPending = false;
  el("alert-status").textContent = "";
  try {
    localStorage.setItem(savedKey, JSON.stringify(point));
  } catch {
    /* Session-only when storage is disabled. */
  }
  marker.setLatLng([lat, lon]).addTo(map);
  map.panTo([lat, lon]);
  el("search-results").hidden = true;
  void refresh();
}

function time(value: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
function state(): Assessment {
  if (loading)
    return {
      state: "unavailable",
      reason: "Checking the forecast for your starting point…",
    };
  if (error) return { state: "unavailable", reason: error };
  if (!point)
    return {
      state: "unavailable",
      reason: "Drop a pin to check the weather for your trip.",
    };
  if (!forecast)
    return {
      state: "unavailable",
      reason: "Waiting for a fresh point forecast.",
    };
  return assess(forecast, point);
}

function render() {
  const result = state();
  const now = Date.now();
  el("location-name").textContent = point?.name || "Pick a point on the map";
  el("coordinates").textContent = point
    ? `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`
    : "Or search an Australian suburb or postcode";
  el("location-check").hidden = !point;
  el("mode-banner").hidden = !demo;
  el("window-card").dataset.state = result.state;
  el("forecast-tag").textContent = demo
    ? "SIMULATED"
    : forecast && !error && result.state !== "unavailable"
      ? "BOM FEED"
      : "NOT CONNECTED";
  el("source-status").textContent = demo
    ? "Demo · simulated weather"
    : forecast && !error && result.state !== "unavailable"
      ? "BOM forecast connected"
      : "BOM · not connected";
  el("window-kicker").textContent = demo
    ? "SIMULATED WEATHER WINDOW"
    : !point
      ? "LET’S FIND YOUR WINDOW"
      : loading
        ? "CHECKING YOUR LOCATION"
        : result.state === "ready"
          ? "YOUR WINDOW IS OPEN"
          : result.state === "waiting"
            ? "A BREAK IS ON THE WAY"
            : "YOUR WEATHER WINDOW";
  el("window-title").textContent = !point
    ? "Choose your spot."
    : loading
      ? "Checking the skies…"
      : result.state === "ready"
        ? "You’ve got time."
        : result.state === "waiting"
          ? `Dry in ${Math.max(1, Math.ceil(((result.start || now) - now) / MINUTE))} min.`
          : result.state === "wet"
            ? "Wait for a break."
            : "Forecast unavailable.";
  el("window-symbol").innerHTML = icon(
    result.state === "wet" || result.state === "waiting" ? "rain" : "sun",
  );
  el("window-message").textContent =
    result.state === "ready"
      ? `${demo ? "Demo: " : ""}At least 30 dry minutes ahead. Window ends ${time(result.end!)}.`
      : result.state === "waiting"
        ? `${demo ? "Demo: " : ""}Next window: ${time(result.start!)}–${time(result.end!)}.`
        : result.reason;
  el<HTMLButtonElement>("watch").disabled =
    !watching && (!forecast || loading || result.state === "unavailable");
  el("watch-label").textContent = watching
    ? "Watching · tap to stop"
    : demo
      ? "Try a demo alert"
      : "Alert me when it’s dry";
  el("demo-prompt-title").textContent = demo
    ? "Try another forecast"
    : "See how it works";
  el("demo-prompt-copy").textContent = demo
    ? rainy
      ? "Show a dry window open now."
      : "Show rain clearing in 10 minutes."
    : "Try a simulated break in the rain.";
  el("demo").setAttribute(
    "aria-label",
    demo ? "Switch demo weather scenario" : "Try demo forecast",
  );
  const valid =
    forecast && !loading && !error && result.state !== "unavailable";
  el("timeline-caption").textContent = valid
    ? `${demo ? "SIMULATED · " : "BOM · "}updated ${time(Date.parse(forecast!.issuedAt))}`
    : "No usable forecast";
  const bars = Array.from({ length: 18 }, (_, index) => {
    const start = now + index * 5 * MINUTE;
    return {
      type: valid ? bucket(forecast!, start, start + 5 * MINUTE) : "unknown",
      start,
    };
  });
  el("rain-bars").innerHTML = bars
    .map(
      (bar) =>
        `<span class="rain-bar ${bar.type}" title="${time(bar.start)}: ${bar.type === "unknown" ? "no complete interval" : bar.type === "dry" ? "no rain forecast" : "rain risk"}"></span>`,
    )
    .join("");
  el("rain-bars").setAttribute(
    "aria-label",
    valid
      ? `${demo ? "Simulated. " : ""}${result.reason} Green: no rain forecast. Blue: rain risk. Grey: no complete interval.`
      : "No usable forecast connected. All intervals unknown.",
  );
  if (watching && !notificationPending && result.state === "ready") {
    notificationPending = true;
    watching = false; // One-shot: explicitly re-arm for another window.
    void notify();
    el("watch-label").textContent = demo
      ? "Try a demo alert"
      : "Alert me when it’s dry";
  }
}

async function refresh() {
  const id = ++requestId;
  controller?.abort();
  controller = new AbortController();
  error = "";
  forecast = undefined;
  if (!point) {
    loading = false;
    render();
    return;
  }
  if (demo) {
    loading = false;
    forecast = demoForecast(point, rainy);
    render();
    return;
  }
  loading = true;
  render();
  try {
    const response = await fetch(
      `/api/forecast?${new URLSearchParams({ lat: String(point.lat), lon: String(point.lon) })}`,
      { signal: controller.signal },
    );
    const body: unknown = await response.json();
    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "Forecast unavailable. Please try again later.";
      throw new Error(message);
    }
    const parsed = parseForecast(body);
    if (id === requestId) forecast = parsed;
  } catch (failure) {
    if (id === requestId)
      error =
        failure instanceof Error ? failure.message : "Forecast unavailable.";
  } finally {
    if (id === requestId) {
      loading = false;
      render();
    }
  }
}

let searchRequest = 0;
el("search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = ++searchRequest;
  const query = el<HTMLInputElement>("search").value.trim();
  if (query.length < 2) return;
  el("search-status").textContent = "Finding Australian locations…";
  el("search-results").hidden = true;
  try {
    const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`);
    const body: unknown = await response.json();
    if (id !== searchRequest) return;
    if (!response.ok || !Array.isArray(body))
      throw new Error(
        body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
          ? body.error
          : "Search unavailable. Choose a map point instead.",
      );
    const results = el("search-results");
    results.replaceChildren();
    for (const item of body) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.lat !== "number" ||
        typeof item.lon !== "number" ||
        typeof item.name !== "string" ||
        !isAustralianPoint(item.lat, item.lon)
      )
        continue;
      const li = document.createElement("li"),
        button = document.createElement("button");
      button.textContent = item.name;
      button.addEventListener("click", () => {
        selectPoint(item.lat, item.lon, item.name);
        map.setZoom(13);
        el("search-status").textContent = "Location selected.";
      });
      li.append(button);
      results.append(li);
    }
    results.hidden = results.childElementCount === 0;
    el("search-status").textContent = results.hidden
      ? "No locations found. Try a nearby suburb or choose a map point."
      : "Choose your location below.";
  } catch (failure) {
    if (id === searchRequest)
      el("search-status").textContent =
        failure instanceof Error ? failure.message : "Search unavailable.";
  }
});
el("locate").addEventListener("click", () => {
  if (!navigator.geolocation) {
    el("search-status").textContent =
      "Location unavailable. Use postcode search or the map.";
    return;
  }
  el("search-status").textContent = "Finding your location…";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      selectPoint(
        position.coords.latitude,
        position.coords.longitude,
        "Your current location",
      );
      map.setZoom(14);
      el("search-status").textContent = isAustralianPoint(
        position.coords.latitude,
        position.coords.longitude,
      )
        ? "Current location selected."
        : "Choose an Australian location on the map.";
    },
    () => {
      el("search-status").textContent =
        "Couldn’t get your location. Use postcode search or the map.";
    },
    { timeout: 10_000, maximumAge: 60_000 },
  );
});
el("demo").addEventListener("click", () => {
  watching = false;
  notificationPending = false;
  el("alert-status").textContent = "";
  if (!demo) {
    demo = true;
    rainy = false;
    if (!point) {
      point = { ...sydney };
      marker.setLatLng([point.lat, point.lon]).addTo(map);
    }
  } else rainy = !rainy;
  void refresh();
});
el("exit-demo").addEventListener("click", () => {
  demo = false;
  watching = false;
  notificationPending = false;
  el("alert-status").textContent = "";
  point = readLocation();
  if (!point) map.removeLayer(marker);
  else marker.setLatLng([point.lat, point.lon]);
  void refresh();
});

el("watch").addEventListener("click", async () => {
  if (watching) {
    watching = false;
    el("alert-status").textContent = "Watching stopped.";
    render();
    return;
  }
  const id = requestId;
  let permission = "unavailable";
  if ("Notification" in window) {
    permission = Notification.permission;
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = "unavailable";
      }
    }
  }
  if (id !== requestId || state().state === "unavailable") return;
  watching = true;
  notificationPending = false;
  el("alert-status").textContent =
    `${demo ? "Demo only. " : ""}Watching this location. ${permission === "granted" ? "Browser and in-page alert enabled." : "In-page alert only. Browser notifications unavailable or not allowed."}`;
  render();
});
let toastTimer: ReturnType<typeof setTimeout> | undefined;
async function notify() {
  const title = demo
    ? "Demo: your dry window is open"
    : "Your dry window is open";
  const body = `30 minutes for the shops at ${point?.name || "your location"}. ${demo ? "Simulated forecast." : "Check conditions before leaving."}`;
  el("toast").textContent = `${title}. ${body}`;
  el("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el("toast").hidden = true;
  }, 15_000);
  el("alert-status").textContent =
    `${demo ? "Demo alert" : "Dry-window alert"} sent. Watch again for another window.`;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: "weather-window" });
    } catch {
      el("alert-status").textContent +=
        " This browser supports in-page alerts only.";
    }
  }
}
el("about").addEventListener("click", () =>
  el<HTMLDialogElement>("about-dialog").showModal(),
);
el("close-about").addEventListener("click", () =>
  el<HTMLDialogElement>("about-dialog").close(),
);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !demo) void refresh();
});
setInterval(() => {
  if (!demo && point) void refresh();
}, MINUTE);
setInterval(render, 15_000);
void refresh();
