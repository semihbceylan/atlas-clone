import type { FeedStatus, MarketTick, SymbolInfo, Unsubscribe } from "@/types/market";
import { createSeededRandom, roundToTick, seedFromSymbol } from "@/lib/market/generate-candles";

/**
 * Browser-side mock market data feed.
 *
 * The public surface (`subscribe` → `Unsubscribe`) is deliberately identical to
 * what a WebSocket-backed adapter would expose, so swapping in
 * `createWebSocketFeed(...)` later is a one-line change in `use-live-candles`.
 *
 * It simulates a geometric random walk with occasional bursts, which produces
 * price action that *looks* like a real intraday book without pretending to be a
 * market simulator.
 */

export interface MarketFeed {
  /**
   * Subscribes to trades for one symbol.
   *
   * @param symbol Instrument metadata (used for the tick grid and reference price).
   * @param onTick Called for every simulated trade.
   * @param onStatus Optional connection-state callback, mirroring a socket feed.
   */
  subscribe(
    symbol: SymbolInfo,
    onTick: (tick: MarketTick) => void,
    onStatus?: (status: FeedStatus) => void,
    options?: MarketFeedSubscribeOptions,
  ): Unsubscribe;
  /** Stops every active subscription and clears timers. */
  dispose(): void;
}

export interface MockFeedOptions {
  /** Average milliseconds between ticks. Defaults to 450ms. */
  intervalMs?: number;
  /** Per-tick volatility as a fraction of price. Defaults to 0.0006 (~6bps). */
  volatility?: number;
  /** Injectable for tests. */
  now?: () => number;
}

export interface MarketFeedSubscribeOptions {
  /**
   * Price the simulated walk starts from. Defaults to the symbol's reference
   * price.
   *
   * The live series is reanchored to the wall clock on mount, so its most recent
   * close rarely equals the static reference price. Starting the feed anywhere
   * else would make the first tick snap the price and paint a huge synthetic
   * candle; the caller therefore passes the series' actual last close.
   */
  startPrice?: number;
}

/**
 * Creates a feed that emits one tick per interval per symbol.
 *
 * Each subscription owns its own timer and drift state, so unsubscribing on a
 * symbol change deterministically stops that instrument's traffic — there is no
 * shared mutable price state that could leak into the next symbol.
 */
export function createMockFeed(options: MockFeedOptions = {}): MarketFeed {
  const { intervalMs = 450, volatility = 0.0006, now = () => Date.now() } = options;
  const activeSubscriptions = new Set<Unsubscribe>();

  return {
    subscribe(symbol, onTick, onStatus, options) {
      onStatus?.("connecting");

      // Seed per-symbol so the same instrument always produces the same walk.
      const random = createSeededRandom(seedFromSymbol(symbol.symbol, "1m"));

      // Anchor the walk to where the chart actually is, then mean-revert toward
      // that anchor so a long session stays believable instead of drifting away.
      const anchor = options?.startPrice ?? symbol.referencePrice;
      let price = anchor;
      let stopped = false;

      // A slowly mean-reverting drift keeps prices in a believable band instead
      // of drifting to zero or infinity over a long session.
      let drift = (random() - 0.5) * volatility * 0.4;

      const emit = () => {
        if (stopped) return;

        // Rare momentum bursts make the tape feel less mechanical.
        if (random() < 0.04) {
          drift = (random() - 0.5) * volatility * 1.6;
        }

        const shock = (random() - 0.5) * 2 * volatility;
        // Gentle pull toward the anchor (0.2% of the gap per tick) so a long
        // session stays believable instead of drifting away.
        const meanReversion = ((anchor - price) / anchor) * 0.002;
        const rawPrice = price * (1 + drift + shock + meanReversion);

        price = roundToTick(Math.max(symbol.tickSize, rawPrice), symbol.tickSize);

        onTick({
          symbol: symbol.symbol,
          price,
          // Sizes are bursty: mostly small, occasionally large blocks.
          size: Math.max(1, Math.round(random() < 0.08 ? 400 + random() * 1_600 : 5 + random() * 90)),
          time: now(),
        });
      };

      const timer = setInterval(emit, intervalMs);

      const unsubscribe: Unsubscribe = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        activeSubscriptions.delete(unsubscribe);
      };

      activeSubscriptions.add(unsubscribe);
      onStatus?.("simulation");

      return unsubscribe;
    },

    dispose() {
      for (const unsubscribe of [...activeSubscriptions]) unsubscribe();
      activeSubscriptions.clear();
    },
  };
}
