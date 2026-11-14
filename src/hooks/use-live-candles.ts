"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type {
  Candle,
  FeedStatus,
  MarketTick,
  PriceSnapshot,
  Timeframe,
  Unsubscribe,
} from "@/types/market";
import { CandleAggregator } from "@/lib/market/candle-aggregator";
import {
  FALLBACK_SESSION_ANCHOR,
  generateCandles,
  seedFromSymbol,
} from "@/lib/market/generate-candles";
import { isCoinbaseLiveEnabled, subscribeCoinbase } from "@/lib/market/create-coinbase-feed";
import { createMockFeed } from "@/lib/market/create-mock-feed";
import { getSymbolInfo } from "@/config/market-symbols";

/**
 * Live candle orchestration.
 *
 * Two pieces, deliberately separated:
 *
 * 1. `createInitialSnapshot` — a **pure** function that builds a deterministic
 *    sample series. It may run during render (including the server prerender), so
 *    it must never read the clock or touch anything mutable.
 * 2. `MarketController` — a **stateful, mutable** object that owns the live
 *    series, folds trades into candles and fans updates out to subscribers. It is
 *    only ever created and mutated from effects and event callbacks, never
 *    during render.
 *
 * Keeping mutable market state out of the render phase is what lets ticks flow
 * without going through Redux or re-rendering the dashboard, and it is also what
 * the React compiler lint rules require.
 */

/** Candles generated for the initial chart load (~100, per the brief). */
export const INITIAL_CANDLE_COUNT = 100;

/**
 * Minimum gap between price notifications. At the default 450ms tick rate this
 * never drops an update; it exists so a faster feed (or a future WebSocket
 * burst) cannot turn into a render storm.
 */
const PRICE_NOTIFY_THROTTLE_MS = 120;

/** Emitted whenever the visible candle series changes. */
export type CandleEvent =
  | { type: "reset"; candles: Candle[] }
  | { type: "update"; candle: Candle };

export interface MarketSnapshot {
  candles: readonly Candle[];
  price: PriceSnapshot;
}

export interface LiveMarketApi {
  symbol: string;
  timeframe: Timeframe;
  /**
   * Deterministic snapshot for the first render (and for the prerendered HTML).
   * Safe to read during render because it never changes.
   */
  initial: MarketSnapshot;
  /** Current live values. Call from effects and handlers, not during render. */
  getSnapshot: () => MarketSnapshot;
  /** Incremental candle stream. Emits one `reset` per symbol/timeframe change. */
  subscribe: (listener: (event: CandleEvent) => void) => Unsubscribe;
  /** Throttled price stream for header-style UI. */
  subscribePrice: (listener: (snapshot: PriceSnapshot) => void) => Unsubscribe;
}

/**
 * Builds the deterministic, time-independent sample used before the live
 * controller attaches. Anchored to a fixed synthetic session because reading
 * `Date.now()` during render is not allowed: Next.js would freeze that value into
 * the prerendered HTML and flag it as an unstable read.
 */
export function createInitialSnapshot(symbol: string, timeframe: Timeframe): MarketSnapshot {
  const info = getSymbolInfo(symbol);
  if (isCoinbaseLiveEnabled(symbol)) return { candles: [], price: derivePrice(symbol, []) };
  const candles = generateCandles({
    symbol: info,
    timeframe,
    count: INITIAL_CANDLE_COUNT,
    endTime: FALLBACK_SESSION_ANCHOR,
  });

  return { candles, price: derivePrice(symbol, candles) };
}

/** Builds the header snapshot from the first and last candle of a series. */
function derivePrice(
  symbol: string,
  candles: readonly Candle[],
  status: FeedStatus = "idle",
): PriceSnapshot {
  const sessionOpen = candles[0]?.open ?? 0;
  const lastClose = candles[candles.length - 1]?.close ?? sessionOpen;
  const change = lastClose - sessionOpen;

  return {
    symbol,
    price: lastClose,
    change,
    changePercent: sessionOpen === 0 ? 0 : (change / sessionOpen) * 100,
    direction: "flat",
    status,
  };
}

/**
 * Owns the live series for one symbol/timeframe pair.
 *
 * A class (rather than a bag of refs) keeps every mutation behind a named method,
 * which makes the lifecycle obvious: `reanchor` → feed ticks → `dispose`.
 */
class MarketController {
  private readonly timeframe: Timeframe;
  private readonly tickSize: number;
  private readonly sessionSymbol: string;
  private readonly aggregator: CandleAggregator;

  private sessionOpen: number;
  private price: PriceSnapshot;

  private readonly candleListeners = new Set<(event: CandleEvent) => void>();
  private readonly priceListeners = new Set<(snapshot: PriceSnapshot) => void>();

  /** Candles changed during the current animation frame, keyed by bucket time. */
  private readonly pending = new Map<number, Candle>();
  private frameHandle: number | null = null;
  private lastPriceNotify = 0;
  private disposed = false;

  constructor(symbol: string, timeframe: Timeframe, initial: MarketSnapshot) {
    const info = getSymbolInfo(symbol);

    this.sessionSymbol = symbol;
    this.timeframe = timeframe;
    this.tickSize = info.tickSize;
    this.sessionOpen = initial.candles[0]?.open ?? info.referencePrice;
    this.price = initial.price;

    this.aggregator = new CandleAggregator(timeframe, { tickSize: info.tickSize });
    this.aggregator.reset(initial.candles);
  }

  snapshot(): MarketSnapshot {
    return { candles: this.aggregator.snapshot(), price: this.price };
  }

  /** Most recent trade price — the anchor the live feed should start from. */
  get lastPrice(): number {
    return this.price.price;
  }

  /** Replaces the series with one anchored to the real wall clock. */
  reanchor(endTimeSeconds: number): void {
    const info = getSymbolInfo(this.sessionSymbol);
    const candles = generateCandles({
      symbol: info,
      timeframe: this.timeframe,
      count: INITIAL_CANDLE_COUNT,
      endTime: endTimeSeconds,
      // Same seed as the render-time sample: only the timestamps shift.
      seed: seedFromSymbol(this.sessionSymbol, this.timeframe),
    });

    this.sessionOpen = candles[0]?.open ?? info.referencePrice;
    this.aggregator.reset(candles);
    this.price = { ...derivePrice(this.sessionSymbol, candles), status: this.price.status };

    this.emitCandles({ type: "reset", candles });
    this.emitPrice();
  }

  replaceHistory(candles: Candle[]): void {
    this.pending.clear();
    this.aggregator.reset(candles);
    this.sessionOpen = candles[0]?.open ?? 0;
    this.price = derivePrice(this.sessionSymbol, candles, this.price.status);
    this.emitCandles({ type: "reset", candles });
    this.emitPrice();
  }

  applyTick(tick: MarketTick): void {
    const result = this.aggregator.applyTick(tick);
    // Ticks rejected by the aggregator (out-of-order, malformed) are dropped.
    if (!result) return;

    const candle = result.candle;
    if (!this.sessionOpen) this.sessionOpen = candle.open;
    const previousPrice = this.price.price;

    this.price = {
      symbol: this.sessionSymbol,
      price: candle.close,
      change: candle.close - this.sessionOpen,
      changePercent:
        this.sessionOpen === 0 ? 0 : ((candle.close - this.sessionOpen) / this.sessionOpen) * 100,
      direction: candle.close > previousPrice ? "up" : candle.close < previousPrice ? "down" : "flat",
      status: this.price.status,
    };

    this.pending.set(candle.time, candle);
    this.scheduleFlush();
  }

  setStatus(status: FeedStatus): void {
    if (this.price.status === status) return;
    this.price = { ...this.price, status };
    this.emitPrice();
  }

  subscribeCandles(listener: (event: CandleEvent) => void): Unsubscribe {
    this.candleListeners.add(listener);
    return () => {
      this.candleListeners.delete(listener);
    };
  }

  subscribePrice(listener: (snapshot: PriceSnapshot) => void): Unsubscribe {
    this.priceListeners.add(listener);
    return () => {
      this.priceListeners.delete(listener);
    };
  }

  /**
   * Stops every pending frame and drops all listeners so a discarded controller
   * cannot keep the chart, its series or its callbacks alive.
   */
  dispose(): void {
    this.disposed = true;

    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }

    this.pending.clear();
    this.candleListeners.clear();
    this.priceListeners.clear();
  }

  /**
   * Coalesces every tick that lands inside one animation frame into a single
   * batch, so a bursty feed never queues more work than the browser can paint.
   */
  private scheduleFlush(): void {
    if (this.frameHandle !== null || this.disposed) return;

    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null;

      // `pending` is keyed by bucket time and only ever receives non-decreasing
      // times, so iteration order is chronological — required by `series.update`.
      if (this.pending.size > 0) {
        for (const candle of this.pending.values()) {
          this.emitCandles({ type: "update", candle });
        }
        this.pending.clear();
      }

      if (performance.now() - this.lastPriceNotify >= PRICE_NOTIFY_THROTTLE_MS) {
        this.emitPrice();
      }
    });
  }

  private emitCandles(event: CandleEvent): void {
    for (const listener of this.candleListeners) listener(event);
  }

  private emitPrice(): void {
    this.lastPriceNotify = performance.now();
    for (const listener of this.priceListeners) listener(this.price);
  }
}

/**
 * One shared feed instance. It keeps no cross-subscription state, so a single
 * instance is enough and keeps timer bookkeeping in one place.
 */
const feed = createMockFeed();

/**
 * Connects one symbol/timeframe pair to the market feed.
 *
 * The controller is created lazily on first use *after* mount (it is reached
 * through effects, never during render), which keeps the render phase pure while
 * still giving every consumer the same instance. Changing the symbol or timeframe
 * produces a new api object; the effect cleanup disposes the previous controller
 * and unsubscribes the previous feed, so switching symbols can never leave a
 * stale timer writing into the chart.
 */
export function useLiveCandles(symbol: string, timeframe: Timeframe): LiveMarketApi {
  const controllerRef = useRef<MarketController | null>(null);

  /** Deterministic sample, computed once per symbol/timeframe. */
  const initial = useMemo(() => createInitialSnapshot(symbol, timeframe), [symbol, timeframe]);

  useEffect(() => {
    const info = getSymbolInfo(symbol);

    // Reuse a controller created earlier in this same mount (e.g. by the chart's
    // data effect, which runs before this one), otherwise start fresh.
    const controller =
      controllerRef.current ?? new MarketController(symbol, timeframe, initial);
    controllerRef.current = controller;

    let unsubscribe: Unsubscribe;
    if (isCoinbaseLiveEnabled(symbol)) {
      unsubscribe = subscribeCoinbase({
        symbol, timeframe,
        onTick: tick => controller.applyTick(tick),
        onHistory: candles => controller.replaceHistory(candles),
        onStatus: status => controller.setStatus(status),
      });
    } else {
      controller.reanchor(Math.floor(Date.now() / 1000));
      unsubscribe = feed.subscribe(info, tick => controller.applyTick(tick), status => controller.setStatus(status), { startPrice: controller.lastPrice });
    }

    return () => {
      unsubscribe();
      controller.dispose();
      controllerRef.current = null;
    };
  }, [symbol, timeframe, initial]);

  // The api identity changes with symbol/timeframe so consumers can use it as an
  // effect dependency and reset their own views deterministically.
  return useMemo<LiveMarketApi>(() => {
    const ensure = () => {
      controllerRef.current ??= new MarketController(symbol, timeframe, initial);
      return controllerRef.current;
    };

    return {
      symbol,
      timeframe,
      initial,
      getSnapshot: () => controllerRef.current?.snapshot() ?? initial,
      subscribe: (listener) => ensure().subscribeCandles(listener),
      subscribePrice: (listener) => ensure().subscribePrice(listener),
    };
  }, [symbol, timeframe, initial]);
}

/**
 * Subscribes to throttled price updates.
 *
 * The snapshot keeps its identity while the value is unchanged, so a quiet tape
 * does not re-render the header.
 */
export function useLivePrice(api: LiveMarketApi): PriceSnapshot {
  const subscribe = useMemo(() => (notify: () => void) => api.subscribePrice(() => notify()), [api]);
  return useSyncExternalStore(subscribe, () => api.getSnapshot().price, () => api.initial.price);
}
