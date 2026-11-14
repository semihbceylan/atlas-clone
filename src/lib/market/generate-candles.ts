import {
  type Candle,
  type SymbolInfo,
  type Timeframe,
  TIMEFRAME_SECONDS,
} from "@/types/market";

/**
 * Deterministic intraday OHLCV generator.
 *
 * The chart must look identical on every reload (and between server and client),
 * so randomness comes from a seeded PRNG rather than `Math.random()`.
 * Given the same `seed` and `endTime` this function is a pure function.
 */

/**
 * `mulberry32` — small, fast, well-distributed 32-bit PRNG.
 * Good enough for visual simulation and far cheaper than a crypto PRNG.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derives a stable numeric seed from a symbol + timeframe pair. */
export function seedFromSymbol(symbol: string, timeframe: Timeframe): number {
  let hash = 2166136261;
  const input = `${symbol}:${timeframe}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Floors a UTC-seconds timestamp down to the start of its timeframe bucket. */
export function bucketStart(timeSeconds: number, timeframe: Timeframe): number {
  const size = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(timeSeconds / size) * size;
}

/**
 * Deterministic session anchor used for the very first render.
 *
 * Reading `Date.now()` while rendering is not allowed: Next.js flags it as an
 * unstable value that would be frozen into the prerendered HTML. So the render
 * phase builds a fully deterministic series anchored at this fixed synthetic
 * session, and `useLiveCandles` re-anchors it to the real wall clock from an
 * effect, where reading the clock is safe and correct.
 */
export const FALLBACK_SESSION_ANCHOR = Date.UTC(2026, 0, 2, 7, 30, 0) / 1000;

/** Rounds a price to the instrument's tick size, avoiding float noise. */
export function roundToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  const decimals = Math.max(0, Math.round(-Math.log10(tickSize)));
  const snapped = Math.round(price / tickSize) * tickSize;
  return Number(snapped.toFixed(decimals));
}

export interface GenerateCandlesOptions {
  /** Instrument to generate data for. */
  symbol: SymbolInfo;
  timeframe: Timeframe;
  /** Number of candles to produce. The brief asks for ~100. */
  count: number;
  /**
   * UTC seconds marking the end of the series (the open of the last candle's
   * bucket). Required: the caller decides what "now" means, which keeps this
   * function pure and prerender-safe.
   */
  endTime: number;
  /** Overrides the seed derived from the symbol. */
  seed?: number;
}

/**
 * Builds a chronologically ordered candle series ending at `endTime`.
 *
 * Guarantees:
 * - `time` values are strictly increasing and bucket-aligned;
 * - `low <= min(open, close)` and `high >= max(open, close)`;
 * - `volume > 0` and correlated with the absolute return of the candle;
 * - prices stay in the neighbourhood of the symbol's reference price.
 */
export function generateCandles({
  symbol,
  timeframe,
  count,
  endTime,
  seed,
}: GenerateCandlesOptions): Candle[] {
  const size = TIMEFRAME_SECONDS[timeframe];
  const lastOpen = bucketStart(endTime, timeframe);
  const random = createSeededRandom(seed ?? seedFromSymbol(symbol.symbol, timeframe));

  // Volatility scales with the square root of time, like a random walk does.
  const volatilityPerBar = 0.0016 * Math.sqrt(size / 60);
  // A deterministic bias keeps the series drifting gently instead of wandering away.
  const drift = (random() - 0.5) * volatilityPerBar * 0.25;
  const baseVolume = 42_000 * Math.sqrt(size / 60);

  const candles: Candle[] = [];
  let previousClose = symbol.referencePrice * (1 - drift * count * 0.5);

  for (let index = 0; index < count; index += 1) {
    const time = lastOpen - (count - 1 - index) * size;

    // Box–Muller gives a normally distributed return from two uniform samples.
    const u1 = Math.max(random(), Number.EPSILON);
    const u2 = random();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const returnPct = drift + gaussian * volatilityPerBar;

    const open = previousClose;
    const close = open * (1 + returnPct);

    const body = Math.abs(close - open);
    const wickScale = volatilityPerBar * open;
    const upperWick = random() * (wickScale * 0.9) + body * 0.15;
    const lowerWick = random() * (wickScale * 0.9) + body * 0.15;

    const high = Math.max(open, close) + upperWick;
    const low = Math.max(symbol.tickSize, Math.min(open, close) - lowerWick);

    // Volume tracks the candle's activity: bigger moves trade more shares.
    const activity = 1 + (Math.abs(returnPct) / Math.max(volatilityPerBar, 1e-9)) * 0.9;
    const volume = Math.round(
      baseVolume * activity * (0.55 + random() * 0.9) * (1 + index / (count * 4)),
    );

    candles.push(
      normaliseCandle(
        { time, open, high, low, close, volume },
        symbol.tickSize,
      ),
    );

    previousClose = candles[candles.length - 1].close;
  }

  return candles;
}

/**
 * Repairs a candle so the OHLC invariants always hold and prices sit on the
 * instrument's tick grid. Used both by the generator and by anything consuming
 * untrusted data (a future WebSocket feed).
 */
export function normaliseCandle(candle: Candle, tickSize: number): Candle {
  const open = roundToTick(candle.open, tickSize);
  const close = roundToTick(candle.close, tickSize);
  const high = roundToTick(Math.max(candle.high, open, close), tickSize);
  const low = roundToTick(Math.min(candle.low, open, close), tickSize);


  return {
    time: candle.time,
    open,
    high,
    low,
    close,
    volume: Math.max(0, Math.round(candle.volume)),
  };
}

/** Returns the open time of the bucket that follows `time`. */
export function nextBucketTime(time: number, timeframe: Timeframe): number {
  return time + TIMEFRAME_SECONDS[timeframe];
}
