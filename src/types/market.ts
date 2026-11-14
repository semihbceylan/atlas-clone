/**
 * Domain model for the simulated market data layer.
 *
 * Everything in the terminal is built on these types. They intentionally mirror
 * the shape of real exchange payloads (OHLCV candles + trades/ticks) so the mock
 * feed can be swapped for a WebSocket adapter without touching UI code.
 */

/** Supported chart intervals. */
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1D";

/** Length of a timeframe bucket in seconds. */
export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "1D": 24 * 60 * 60,
};

export const TIMEFRAMES: readonly Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];

/** Trading session label shown in the UI. */
export type MarketSession = "pre" | "regular" | "post" | "closed";

/**
 * A single OHLCV candle.
 *
 * `time` is the *open* time of the bucket expressed in **UTC seconds** — the
 * format `lightweight-charts` expects for an `UTCTimestamp`.
 */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * A single real or simulated trade. Matches the tick payload a WebSocket feed would
 * deliver (`{ s: symbol, p: price, q: quantity, t: timestamp }`).
 */
export interface MarketTick {
  symbol: string;
  /** Trade price. */
  price: number;
  /** Traded quantity (shares), always > 0. */
  size: number;
  /** Trade timestamp in milliseconds since epoch. */
  time: number;
}

/** Static metadata about a tradable symbol. */
export interface SymbolInfo {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  /** Minimum price increment, used to snap simulated prices. */
  tickSize: number;
  /** Anchor price used to seed the generator. */
  referencePrice: number;
}

/** A row rendered in the "Takip Ettiklerim" widget. */
export interface WatchlistItem {
  symbol: string;
  name: string;
  /** Last known price (snapshot, not streaming). */
  price: number;
  /** Daily change in percent, e.g. `1.42` means +1.42%. */
  changePercent: number;
}

/** A row rendered in the "Pozisyonlar" widget. */
export interface Position {
  id: string;
  symbol: string;
  /** Signed quantity: positive = long, negative = short. */
  quantity: number;
  /** Volume-weighted entry price. */
  averagePrice: number;
  /** Realised/unrealised P&L in account currency. */
  unrealizedPnl: number;
}

/** Connection state of the market feed. */
export type FeedStatus = "idle" | "connecting" | "live" | "reconnecting" | "simulation" | "error";

/** Lightweight snapshot of the live price, used by the header. */
export interface PriceSnapshot {
  symbol: string;
  price: number;
  /** Absolute change vs. the first candle of the session. */
  change: number;
  /** Change in percent vs. the first candle of the session. */
  changePercent: number;
  /** Whether the most recent movement was upward. */
  direction: "up" | "down" | "flat";
  /** Feed connection state, surfaced as the "live" indicator. */
  status: FeedStatus;
}

/** Release function returned by every subscription. */
export type Unsubscribe = () => void;
