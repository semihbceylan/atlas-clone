import {
  type Candle,
  type MarketTick,
  type Timeframe,
  TIMEFRAME_SECONDS,
} from "@/types/market";
import { normaliseCandle } from "@/lib/market/generate-candles";

/**
 * Turns a stream of trades into OHLCV candles.
 *
 * This is the piece that a real WebSocket adapter would feed, so it is written
 * as a plain, framework-free class with explicit failure modes instead of
 * throwing on bad input:
 *
 * - ticks arriving inside the current bucket mutate the open candle;
 * - the first tick of a new bucket closes the previous candle and opens a new one;
 * - ticks older than the current bucket are **rejected** (they went back in time,
 *   which happens on reconnects) and never rewrite history;
 * - malformed ticks (NaN, negative size, non-finite price) are rejected.
 */

export interface AggregatorApplyResult {
  /** The candle that changed, already normalised and validated. */
  candle: Candle;
  /** `true` when the tick opened a new bucket. */
  isNewCandle: boolean;
}

export interface CandleAggregatorOptions {
  /** Instrument tick size used to snap prices. Defaults to `0.01`. */
  tickSize?: number;
  /** Maximum number of closed candles retained. Guards against unbounded memory. */
  maxCandles?: number;
}

export class CandleAggregator {
  private readonly bucketSeconds: number;
  private readonly tickSize: number;
  private readonly maxCandles: number;
  /** Chronologically ordered, strictly increasing by `time`. */
  private candles: Candle[] = [];

  constructor(timeframe: Timeframe, options: CandleAggregatorOptions = {}) {
    this.bucketSeconds = TIMEFRAME_SECONDS[timeframe];
    this.tickSize = options.tickSize ?? 0.01;
    this.maxCandles = options.maxCandles ?? 1_000;
  }

  /** Current candle, or `null` when the aggregator is empty. */
  get current(): Candle | null {
    return this.candles.length > 0 ? this.candles[this.candles.length - 1] : null;
  }

  /** Read-only view of every candle held in memory. */
  snapshot(): readonly Candle[] {
    return this.candles;
  }

  /** Replaces the whole series, e.g. after a symbol or timeframe change. */
  reset(candles: readonly Candle[] = []): void {
    const sorted = [...candles]
      .filter(isValidCandle)
      .map((candle) => normaliseCandle(candle, this.tickSize))
      .sort((a, b) => a.time - b.time);

    // De-duplicate while keeping the last value seen for a timestamp.
    const deduped: Candle[] = [];
    for (const candle of sorted) {
      const previous = deduped[deduped.length - 1];
      if (previous && previous.time === candle.time) {
        deduped[deduped.length - 1] = candle;
      } else {
        deduped.push(candle);
      }
    }

    this.candles = deduped.slice(-this.maxCandles);
  }

  /** Start time of the bucket a timestamp belongs to (UTC seconds). */
  bucketStartOf(tick: MarketTick): number {
    const seconds = Math.floor(tick.time / 1000);
    return Math.floor(seconds / this.bucketSeconds) * this.bucketSeconds;
  }

  /**
   * Applies one trade.
   *
   * @returns The mutated candle, or `null` when the tick was rejected.
   */
  applyTick(tick: MarketTick): AggregatorApplyResult | null {
    if (!isValidTick(tick)) return null;

    const bucketTime = this.bucketStartOf(tick);
    const price = tick.price;
    const current = this.current;

    if (!current) {
      const candle = this.pushCandle({
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: tick.size,
      });
      return { candle, isNewCandle: true };
    }

    if (bucketTime < current.time) {
      // Out-of-order event: refuse to rewrite an already closed candle.
      return null;
    }

    if (bucketTime > current.time) {
      const candle = this.pushCandle({
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: tick.size,
      });
      return { candle, isNewCandle: true };
    }

    // Same bucket: mutate in place. The array is owned by this class, so an
    // in-place update (plus a fresh object for React consumers) is safe.
    const updated = normaliseCandle(
      {
        time: current.time,
        open: current.open,
        high: Math.max(current.high, price),
        low: Math.min(current.low, price),
        close: price,
        volume: current.volume + tick.size,
      },
      this.tickSize,
    );

    this.candles[this.candles.length - 1] = updated;
    return { candle: updated, isNewCandle: false };
  }

  /** Applies many ticks in order, returning only the candles that changed. */
  applyTicks(ticks: readonly MarketTick[]): AggregatorApplyResult[] {
    const results: AggregatorApplyResult[] = [];
    for (const tick of ticks) {
      const result = this.applyTick(tick);
      if (result) results.push(result);
    }
    return results;
  }

  private pushCandle(candle: Candle): Candle {
    const normalised = normaliseCandle(candle, this.tickSize);
    const previous = this.candles[this.candles.length - 1];

    // Defensive: never allow a non-increasing timestamp into the series.
    if (previous && normalised.time <= previous.time) return previous;

    this.candles.push(normalised);
    if (this.candles.length > this.maxCandles) {
      this.candles.splice(0, this.candles.length - this.maxCandles);
    }
    return normalised;
  }
}

/** A tick is usable only when every field is a finite number of the right sign. */
export function isValidTick(tick: MarketTick | null | undefined): tick is MarketTick {
  if (!tick) return false;
  return (
    typeof tick.symbol === "string" &&
    tick.symbol.length > 0 &&
    Number.isFinite(tick.price) &&
    tick.price > 0 &&
    Number.isFinite(tick.size) &&
    tick.size > 0 &&
    Number.isFinite(tick.time)
  );
}

/** Guards against candles that would break Lightweight Charts. */
export function isValidCandle(candle: Candle | null | undefined): candle is Candle {
  if (!candle) return false;
  return (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    candle.high >= candle.low
  );
}
