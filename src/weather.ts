export type Point = { lat: number; lon: number; name: string };
export type Interval = {
  start: string;
  end: string;
  rainMm: number;
  rainChance: number;
};
export type Forecast = {
  source: "BOM";
  issuedAt: string;
  point: { lat: number; lon: number };
  intervals: Interval[];
};
export type Assessment = {
  state: "ready" | "waiting" | "wet" | "unavailable";
  reason: string;
  start?: number;
  end?: number;
};
export const MINUTE = 60_000;
export const TRIP_MINUTES = 30;
export const MAX_AGE = 15 * MINUTE;

export function isAustralianPoint(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -45 &&
    lat <= -9 &&
    lon >= 96 &&
    lon <= 169
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

// Only complete, fine-grained point forecasts qualify. Radar history is not a forecast.
export function parseForecast(value: unknown): Forecast {
  if (
    !record(value) ||
    value.source !== "BOM" ||
    !timestamp(value.issuedAt) ||
    !record(value.point) ||
    typeof value.point.lat !== "number" ||
    typeof value.point.lon !== "number" ||
    !isAustralianPoint(value.point.lat, value.point.lon) ||
    !Array.isArray(value.intervals) ||
    value.intervals.length === 0 ||
    value.intervals.length > 120
  ) {
    throw new Error("Forecast feed returned an invalid point forecast.");
  }
  let previousEnd = -Infinity;
  const intervals = value.intervals.map((item: unknown): Interval => {
    if (
      !record(item) ||
      !timestamp(item.start) ||
      !timestamp(item.end) ||
      typeof item.rainMm !== "number" ||
      !Number.isFinite(item.rainMm) ||
      item.rainMm < 0 ||
      typeof item.rainChance !== "number" ||
      !Number.isFinite(item.rainChance) ||
      item.rainChance < 0 ||
      item.rainChance > 100
    )
      throw new Error("Forecast contains missing or invalid rain data.");
    const start = Date.parse(item.start),
      end = Date.parse(item.end);
    if (end <= start || end - start > 5 * MINUTE || start < previousEnd) {
      throw new Error(
        "Forecast needs ordered, non-overlapping intervals of at most 5 minutes.",
      );
    }
    previousEnd = end;
    return {
      start: item.start,
      end: item.end,
      rainMm: item.rainMm,
      rainChance: item.rainChance,
    };
  });
  return {
    source: "BOM",
    issuedAt: value.issuedAt,
    point: { lat: value.point.lat, lon: value.point.lon },
    intervals,
  };
}

export function isDry(interval: Interval): boolean {
  return interval.rainMm === 0 && interval.rainChance <= 20;
}

export function bucket(
  forecast: Forecast,
  start: number,
  end: number,
): "dry" | "rain" | "unknown" {
  let cursor = start;
  let dry = true;
  for (const interval of forecast.intervals) {
    const from = Date.parse(interval.start),
      to = Date.parse(interval.end);
    if (to <= cursor) continue;
    if (from > cursor) return "unknown";
    dry &&= isDry(interval);
    cursor = to;
    if (cursor >= end) return dry ? "dry" : "rain";
  }
  return "unknown";
}

export function assess(
  forecast: Forecast,
  point: Point,
  now = Date.now(),
): Assessment {
  const unavailable = (reason: string): Assessment => ({
    state: "unavailable",
    reason,
  });
  const age = now - Date.parse(forecast.issuedAt);
  if (age > MAX_AGE || age < -MINUTE)
    return unavailable("Forecast out of date. Waiting for a fresh update.");
  const latDistance = (forecast.point.lat - point.lat) * 111_320;
  const lonDistance =
    (forecast.point.lon - point.lon) *
    111_320 *
    Math.cos((point.lat * Math.PI) / 180);
  if (Math.hypot(latDistance, lonDistance) > 250)
    return unavailable("Forecast does not match your selected location.");

  const runs: { start: number; end: number }[] = [];
  let run: { start: number; end: number } | undefined;
  let coveredUntil = now;
  for (const interval of forecast.intervals) {
    const start = Date.parse(interval.start),
      end = Date.parse(interval.end);
    if (end <= now) continue;
    if (start <= coveredUntil) coveredUntil = Math.max(coveredUntil, end);
    if (!isDry(interval)) {
      run = undefined;
      continue;
    }
    if (run && start === run.end) run.end = end;
    else {
      run = { start, end };
      runs.push(run);
    }
  }
  const needed = TRIP_MINUTES * MINUTE;
  const current = runs.find(
    (item) => item.start <= now && item.end - now >= needed,
  );
  if (current)
    return {
      state: "ready",
      reason: "No rain forecast for your 30-minute trip.",
      ...current,
    };
  const next = runs.find(
    (item) => item.start > now && item.end - item.start >= needed,
  );
  if (next)
    return {
      state: "waiting",
      reason: "A 30-minute dry window is coming up.",
      ...next,
    };
  if (coveredUntil < now + needed)
    return unavailable(
      "Not enough continuous forecast coverage for a 30-minute trip.",
    );
  return {
    state: "wet",
    reason: "Rain is forecast within your next 30 minutes.",
  };
}

export function demoForecast(
  point: Point,
  rainy: boolean,
  now = Date.now(),
): Forecast {
  return {
    source: "BOM",
    issuedAt: new Date(now).toISOString(),
    point,
    intervals: Array.from({ length: 18 }, (_, i) => ({
      start: new Date(now + i * 5 * MINUTE).toISOString(),
      end: new Date(now + (i + 1) * 5 * MINUTE).toISOString(),
      rainMm: (rainy ? i < 2 || i >= 12 : i >= 10) ? 0.4 : 0,
      rainChance: (rainy ? i < 2 || i >= 12 : i >= 10) ? 85 : 10,
    })),
  };
}
