import type { Candle, FeedStatus, MarketTick, Timeframe, Unsubscribe } from "@/types/market";
import { TIMEFRAME_SECONDS } from "@/types/market";

export const COINBASE_PRODUCTS: Record<string, string> = { BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD" };
/** Public builds default to synthetic data. A local evaluator can opt in after reviewing the data provider's terms. */
export function isCoinbaseLiveEnabled(symbol: string): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_COINBASE_LIVE_DATA === "true" && Boolean(COINBASE_PRODUCTS[symbol]);
}

export const COINBASE_WEBSOCKET_URL = "wss://ws-feed.exchange.coinbase.com";

/** Reject malformed, unrelated and non-trade messages before they reach the chart. */
export function parseCoinbaseTrade(data: unknown, symbol: string): (MarketTick & { tradeId: number }) | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.type !== "ticker" || message.product_id !== COINBASE_PRODUCTS[symbol]) return null;
  const price = Number(message.price);
  const size = Number(message.last_size);
  const time = typeof message.time === "string" ? Date.parse(message.time) : NaN;
  const tradeId = typeof message.trade_id === "number" ? message.trade_id : NaN;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(size) || size <= 0 || !Number.isFinite(time) || !Number.isSafeInteger(tradeId) || tradeId < 0) return null;
  return { symbol, price, size, time, tradeId };
}

export function parseCoinbaseCandles(data: unknown): Candle[] {
  if (!Array.isArray(data)) throw new Error("Invalid candle response");
  const candles = new Map<number, Candle>();
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 6 || !row.slice(0, 6).every(value => typeof value === "number" && Number.isFinite(value))) continue;
    const [time, low, high, open, close, volume] = row as number[];
    if (time < 0 || low <= 0 || high < low || open < low || open > high || close < low || close > high || volume < 0) continue;
    candles.set(time, { time, low, high, open, close, volume });
  }
  return [...candles.values()].sort((a, b) => a.time - b.time);
}

interface CoinbaseSubscription {
  symbol: string;
  timeframe: Timeframe;
  onTick: (tick: MarketTick) => void;
  onHistory: (candles: Candle[]) => void;
  onStatus: (status: FeedStatus) => void;
}

/** Public market data only. Each subscription owns its socket, requests and retry timers. */
export function subscribeCoinbase({ symbol, timeframe, onTick, onHistory, onStatus }: CoinbaseSubscription): Unsubscribe {
  const product = COINBASE_PRODUCTS[symbol];
  if (!product) throw new Error("Unsupported Coinbase symbol");
  let stopped = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let historyAbort: AbortController | null = null;
  let historyTimeout: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let lastMessageAt = Date.now();
  let lastTradeId = -1;
  let loadingHistory = true;
  let buffered: (MarketTick & { tradeId: number })[] = [];

  const applyTrade = (trade: MarketTick & { tradeId: number }) => {
    if (trade.tradeId <= lastTradeId) return;
    lastTradeId = trade.tradeId;
    onTick(trade);
    onStatus("live");
    attempts = 0;
  };

  const connect = () => {
    if (stopped) return;
    onStatus(attempts ? "reconnecting" : "connecting");
    loadingHistory = true;
    buffered = [];
    lastMessageAt = Date.now();
    const current = new WebSocket(COINBASE_WEBSOCKET_URL);
    socket = current;
    current.onopen = () => {
      if (stopped || socket !== current) return;
      current.send(JSON.stringify({ type: "subscribe", product_ids: [product], channels: ["ticker", "heartbeat"] }));
      // Load real OHLC history while buffering the stream; never seed live prices with synthetic candles.
      const abort = new AbortController();
      historyAbort = abort;
      const timeout = setTimeout(() => abort.abort(), 8_000);
      historyTimeout = timeout;
      const seconds = TIMEFRAME_SECONDS[timeframe];
      const end = Math.floor(Date.now() / 1000 / seconds) * seconds;
      const query = new URLSearchParams({ granularity: String(seconds), start: new Date((end - 150 * seconds) * 1000).toISOString(), end: new Date(end * 1000).toISOString() });
      void fetch(`https://api.exchange.coinbase.com/products/${product}/candles?${query}`, { signal: abort.signal })
        .then(response => { if (!response.ok) throw new Error(`History HTTP ${response.status}`); return response.json(); })
        .then(data => {
          if (stopped || socket !== current) return;
          // Exclude the open REST bucket: buffered trades build it once, without double-counting volume.
          const candles = parseCoinbaseCandles(data).filter(candle => candle.time < end);
          if (candles.length) onHistory(candles);
        })
        .catch(() => { /* The stream can build candles even when REST history is unavailable. */ })
        .finally(() => {
          clearTimeout(timeout);
          if (stopped || socket !== current) return;
          loadingHistory = false;
          buffered.sort((a, b) => a.tradeId - b.tradeId).forEach(applyTrade);
          buffered = [];
        });
    };
    current.onmessage = event => {
      if (stopped || socket !== current) return;
      let data: unknown;
      try { data = JSON.parse(String(event.data)); } catch { return; }
      lastMessageAt = Date.now();
      if ((data as { type?: string })?.type === "error") { current.close(); return; }
      const trade = parseCoinbaseTrade(data, symbol);
      if (!trade) return;
      if (loadingHistory) {
        buffered.push(trade);
        if (buffered.length > 2_000) buffered.shift();
      } else applyTrade(trade);
    };
    current.onerror = () => { if (!stopped && socket === current) { onStatus("error"); current.close(); } };
    current.onclose = () => {
      if (stopped || socket !== current) return;
      historyAbort?.abort();
      clearTimeout(historyTimeout);
      socket = null;
      attempts += 1;
      onStatus("reconnecting");
      retry = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** Math.min(attempts - 1, 5)) + Math.random() * 300);
    };
  };
  connect();
  const watchdog = setInterval(() => {
    if (socket && Date.now() - lastMessageAt > 30_000) socket.close();
  }, 5_000);
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(watchdog);
    historyAbort?.abort();
    clearTimeout(historyTimeout);
    if (socket) { socket.onclose = null; socket.onerror = null; socket.onmessage = null; socket.onopen = null; socket.close(); }
    buffered = [];
  };
}
