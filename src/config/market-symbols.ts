import type { SymbolInfo, WatchlistItem } from "@/types/market";
import { seedFromSymbol } from "@/lib/market/generate-candles";

/**
 * Instrument catalogue.
 *
 * USD crypto instruments use Coinbase's public market feed. TRY equities use
 * illustrative reference prices and a local simulation. Crypto reference prices
 * are metadata only and never seed the live chart.
 */

export const DEFAULT_SYMBOL = "BTC";

export const SYMBOLS: Record<string, SymbolInfo> = {
  BTC: { symbol: "BTC", name: "Bitcoin", exchange: "Coinbase", currency: "USD", tickSize: 0.01, referencePrice: 65000 },
  ETH: { symbol: "ETH", name: "Ethereum", exchange: "Coinbase", currency: "USD", tickSize: 0.01, referencePrice: 2000 },
  SOL: { symbol: "SOL", name: "Solana", exchange: "Coinbase", currency: "USD", tickSize: 0.01, referencePrice: 100 },
  ASTOR: {
    symbol: "ASTOR",
    name: "Astor Enerji",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 157.4,
  },
  THYAO: {
    symbol: "THYAO",
    name: "Türk Hava Yolları",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 318.75,
  },
  ASELS: {
    symbol: "ASELS",
    name: "Aselsan",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 68.35,
  },
  EREGL: {
    symbol: "EREGL",
    name: "Ereğli Demir Çelik",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 27.12,
  },
  GARAN: {
    symbol: "GARAN",
    name: "Garanti BBVA",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 92.8,
  },
  TUPRS: {
    symbol: "TUPRS",
    name: "Tüpraş",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 176.9,
  },
  SISE: {
    symbol: "SISE",
    name: "Şişecam",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 41.56,
  },
  KCHOL: {
    symbol: "KCHOL",
    name: "Koç Holding",
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: 189.3,
  },
};

/**
 * Returns metadata for a symbol, synthesising a deterministic entry for unknown
 * tickers. That keeps "add any symbol" flows working without a hard failure.
 */
export function getSymbolInfo(symbol: string): SymbolInfo {
  const known = SYMBOLS[symbol];
  if (known) return known;

  const seed = seedFromSymbol(symbol, "1m");
  const referencePrice = 20 + (seed % 40_000) / 200;

  return {
    symbol,
    name: symbol,
    exchange: "BIST",
    currency: "TRY",
    tickSize: 0.01,
    referencePrice: Number(referencePrice.toFixed(2)),
  };
}

/** Candidate rows offered by the "sembol ekle" control in the watchlist widget. */
export const WATCHLIST_CATALOG: readonly WatchlistItem[] = Object.values(SYMBOLS)
  .map((symbol, index) => {
    const seed = seedFromSymbol(symbol.symbol, "1D");
    // Deterministic, plausible daily moves between roughly -3% and +3%.
    const changePercent = Number((((seed % 600) - 300) / 100).toFixed(2));

    return {
      symbol: symbol.symbol,
      name: symbol.name,
      price: symbol.currency === "USD" ? 0 : Number((symbol.referencePrice * (1 + changePercent / 100)).toFixed(2)),
      changePercent: symbol.currency === "USD" ? 0 : Number((changePercent + index * 0.13).toFixed(2)),
    };
  });
