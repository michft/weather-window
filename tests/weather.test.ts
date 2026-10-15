import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assess,
  bucket,
  demoForecast,
  MINUTE,
  parseForecast,
} from "../src/weather.ts";

const now = Date.parse("2026-10-15T03:00:00Z");
const point = { lat: -33.8688, lon: 151.2093, name: "Sydney" };

test("30-minute shopping windows require fresh, continuous, low-risk coverage", () => {
  const dry = parseForecast(demoForecast(point, false, now));
  assert.equal(assess(dry, point, now).state, "ready");
  assert.equal(assess(dry, point, now + 15 * MINUTE).state, "ready");
  assert.equal(assess(dry, point, now + 15 * MINUTE + 1).state, "unavailable");
  const clearing = parseForecast(demoForecast(point, true, now));
  assert.equal(assess(clearing, point, now).state, "waiting");
  assert.equal(assess(clearing, point, now).start, now + 10 * MINUTE);
  assert.equal(assess(clearing, point, now + 10 * MINUTE).state, "ready");

  const exact = { ...dry, intervals: dry.intervals.slice(0, 6) };
  assert.equal(assess(exact, point, now).state, "ready");
  assert.equal(
    assess(exact, point, now + 1).state,
    "unavailable",
    "29:59 is not a full trip",
  );
  assert.equal(
    assess({ ...dry, point: { lat: -37.8, lon: 144.9 } }, point, now).state,
    "unavailable",
  );
  assert.equal(
    assess(
      { ...dry, issuedAt: new Date(now + 2 * MINUTE).toISOString() },
      point,
      now,
    ).state,
    "unavailable",
  );
  const gap = {
    ...exact,
    intervals: exact.intervals.filter((_, i) => i !== 2),
  };
  assert.equal(
    assess(gap, point, now).state,
    "unavailable",
    "missing data cannot mean dry",
  );
  const wet = {
    ...dry,
    intervals: dry.intervals.map((item) => ({ ...item, rainMm: 0.1 })),
  };
  assert.equal(assess(wet, point, now).state, "wet");
  const risky = {
    ...dry,
    intervals: dry.intervals.map((item) => ({ ...item, rainChance: 21 })),
  };
  assert.equal(assess(risky, point, now).state, "wet");
  assert.equal(
    assess(
      {
        ...exact,
        intervals: exact.intervals.map((item) => ({ ...item, rainChance: 20 })),
      },
      point,
      now,
    ).state,
    "ready",
  );

  assert.equal(
    bucket(dry, now + 1, now + 5 * MINUTE + 1),
    "dry",
    "buckets span multiple intervals",
  );
  assert.equal(bucket(dry, now + 49 * MINUTE, now + 54 * MINUTE), "rain");
  assert.equal(bucket(gap, now + 8 * MINUTE, now + 13 * MINUTE), "unknown");
  assert.equal(bucket(dry, now + 89 * MINUTE, now + 94 * MINUTE), "unknown");
});

test("reject malformed or coarse feeds rather than manufacturing a dry window", () => {
  const good = demoForecast(point, false, now);
  for (const bad of [
    null,
    {},
    { ...good, source: "other" },
    { ...good, issuedAt: "not a date" },
    { ...good, point: { lat: null, lon: 151 } },
    { ...good, intervals: [] },
    { ...good, intervals: [{ ...good.intervals[0], rainMm: null }] },
    { ...good, intervals: [{ ...good.intervals[0], rainMm: -1 }] },
    { ...good, intervals: [{ ...good.intervals[0], rainChance: 101 }] },
    {
      ...good,
      intervals: [
        {
          ...good.intervals[0],
          end: new Date(now + 60 * MINUTE).toISOString(),
        },
      ],
    },
    { ...good, intervals: [good.intervals[1], good.intervals[0]] },
  ])
    assert.throws(() => parseForecast(bad));
});
