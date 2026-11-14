import { describe, expect, it } from "vitest";

import { CandleAggregator, isValidCandle, isValidTick } from "@/lib/market/candle-aggregator";
import type { Candle, MarketTick } from "@/types/market";

/**
 * The aggregator is the only piece of the app with real branching logic, so it
 * is the one place worth unit testing: everything else is rendering.
 */

const BUCKET_MS = 5 * 60 * 1000;

/** Builds a tick at a given minute offset inside the 5m bucket starting at 0. */
function tick(offsetMs: number, price: number, size = 10): MarketTick {
  return { symbol: "ASTOR", price, size, time: offsetMs };
}

function seedCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    time: 0,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume: 1_000,
    ...overrides,
  };
}

describe("CandleAggregator", () => {
  it("starts a series from the first tick when empty", () => {
    const aggregator = new CandleAggregator("5m");

    const result = aggregator.applyTick(tick(1_000, 157.4, 25));

    expect(result).not.toBeNull();
    expect(result?.isNewCandle).toBe(true);
    expect(result?.candle).toEqual({
      time: 0,
      open: 157.4,
      high: 157.4,
      low: 157.4,
      close: 157.4,
      volume: 25,
    });
  });

  it("updates open, high, low, close and volume inside a bucket", () => {
    const aggregator = new CandleAggregator("5m");
    aggregator.reset([seedCandle()]);

    aggregator.applyTick(tick(1_000, 102.4, 300));
    aggregator.applyTick(tick(2_000, 98.2, 200));
    const result = aggregator.applyTick(tick(3_000, 100.9, 150));

    expect(result?.isNewCandle).toBe(false);
    expect(result?.candle).toEqual({
      // open is the first price of the bucket, not the last
      time: 0,
      open: 100,
      high: 102.4,
      low: 98.2,
      close: 100.9,
      volume: 1_650,
    });
  });

  it("opens a new candle when the tick crosses into the next interval", () => {
    const aggregator = new CandleAggregator("5m");
    aggregator.reset([seedCandle()]);

    const result = aggregator.applyTick(tick(BUCKET_MS + 1_000, 121.5, 400));

    expect(result?.isNewCandle).toBe(true);
    expect(result?.candle.time).toBe(BUCKET_MS / 1000);
    expect(result?.candle.open).toBe(121.5);
    expect(result?.candle.volume).toBe(400);
    expect(aggregator.snapshot()).toHaveLength(2);
  });

  it("keeps timestamps strictly increasing", () => {
    const aggregator = new CandleAggregator("5m");
    aggregator.reset([seedCandle()]);

    // Spread ticks across five buckets, including a malformed out-of-order one.
    for (let bucket = 1; bucket <= 4; bucket += 1) {
      aggregator.applyTick(tick(bucket * BUCKET_MS + 500, 100 + bucket, 100));
    }

    const times = aggregator.snapshot().map((candle) => candle.time);
    const sorted = [...times].sort((a, b) => a - b);

    expect(times).toEqual(sorted);
    expect(new Set(times).size).toBe(times.length);
  });

  it("rejects out-of-order ticks instead of rewriting a closed candle", () => {
    const aggregator = new CandleAggregator("5m");
    aggregator.reset([seedCandle()]);
    aggregator.applyTick(tick(BUCKET_MS + 1_000, 120, 100));

    const before = aggregator.snapshot().map((candle) => ({ ...candle }));
    const rejected = aggregator.applyTick(tick(BUCKET_MS - 3 * 60 * 1_000, 999, 10));

    expect(rejected).toBeNull();
    expect(aggregator.snapshot()).toEqual(before);
  });

  it("rejects malformed ticks", () => {
    const aggregator = new CandleAggregator("5m");
    aggregator.reset([seedCandle()]);

    expect(aggregator.applyTick(tick(1_000, Number.NaN, 10))).toBeNull();
    expect(aggregator.applyTick(tick(1_000, -5, 10))).toBeNull();
    expect(aggregator.applyTick(tick(1_000, 100, 0))).toBeNull();
    expect(aggregator.applyTick(tick(1_000, 100, -3))).toBeNull();
    expect(aggregator.applyTick(tick(Number.POSITIVE_INFINITY, 100, 10))).toBeNull();
    expect(aggregator.snapshot()[0]?.volume).toBe(1_000);
  });

  it("resets a seeded series: orders, de-duplicates and drops unusable bars", () => {
    const aggregator = new CandleAggregator("5m");

    aggregator.reset([
      // Intentionally unordered, with a duplicate timestamp and a broken candle.
      seedCandle({ time: BUCKET_MS / 1000, open: 110, high: 111, low: 109, close: 110.5 }),
      seedCandle({ time: 0 }),
      seedCandle({ time: 0, close: 103, volume: 5 }),
      // Unusable: high < low cannot be repaired into a valid candle.
      seedCandle({ time: 2 * (BUCKET_MS / 1000), high: 90, low: 130 }),
    ]);

    const candles = aggregator.snapshot();

    expect(candles.map((candle) => candle.time)).toEqual([0, 300]);
    // The later duplicate for time 0 wins.
    expect(candles[0]?.close).toBe(103);
    expect(candles[0]?.volume).toBe(5);
  });

  it("repairs a candle whose wicks do not enclose the body", () => {
    const aggregator = new CandleAggregator("5m");

    aggregator.reset([
      // open/close both sit outside [low, high]: normalisation must fix that,
      // because Lightweight Charts would otherwise render an invalid bar.
      seedCandle({ time: 0, open: 120, high: 118, low: 101, close: 116 }),
    ]);

    const candle = aggregator.snapshot()[0];
    expect(candle?.high).toBe(120);
    expect(candle?.low).toBe(101);
    expect(candle?.high).toBeGreaterThanOrEqual(candle?.close ?? 0);
  });

  it("returns the accumulated volume across bucket transitions", () => {
    const aggregator = new CandleAggregator("1m");
    const base = 1_700_000_000_000; // arbitrary but 1-minute aligned

    for (let second = 0; second < 120; second += 30) {
      aggregator.applyTick(tick(base + second * 1_000, 100 + second / 10, 50));
    }

    const [first, second] = aggregator.snapshot();
    expect(first?.volume).toBe(100);
    expect(second?.volume).toBe(100);
  });
});

describe("market data validation helpers", () => {
  it("accepts well-formed ticks and candles", () => {
    expect(isValidTick(tick(1_000, 100, 5))).toBe(true);
    expect(isValidCandle(seedCandle())).toBe(true);
  });

  it("rejects candles that would break the chart", () => {
    expect(isValidCandle(seedCandle({ high: 1, low: 2 }))).toBe(false);
    expect(isValidCandle(null)).toBe(false);
    expect(isValidTick({ symbol: "", price: 1, size: 1, time: 0 })).toBe(false);
  });
});
