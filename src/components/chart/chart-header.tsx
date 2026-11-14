"use client";

import { useCallback, useRef, useState } from "react";
import { CandlestickChart, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import type { Candle, Timeframe } from "@/types/market";
import { formatPrice, formatVolume } from "@/lib/format-price";
import { getSymbolInfo } from "@/config/market-symbols";
import type { PriceSnapshot } from "@/types/market";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectIndicators, toggleIndicator } from "@/store/slices/terminal-slice";

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1m": "1dk", "5m": "5dk", "15m": "15dk", "1h": "1sa", "1D": "1G",
};
interface ChartHeaderProps {
  symbol: string; symbolName: string; timeframe: Timeframe;
  quote: PriceSnapshot; candle: Candle | null; isHovering: boolean; onBuy: () => void; onSell: () => void;
}
export function ChartHeader({ symbol, symbolName, quote, candle, isHovering, onBuy, onSell }: ChartHeaderProps) {
  const dispatch = useAppDispatch();
  const indicators = useAppSelector(selectIndicators);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenuOpen(false), []);
  useClickOutside(ref, menuOpen, close);
  const currency = getSymbolInfo(symbol).currency;
  const money = (value: number) => currency === "USD" ? `$${formatPrice(value, { suffix: "" })}` : formatPrice(value);
  const tone = candle && candle.close < candle.open ? "text-terminal-down" : "text-terminal-up";
  return (
    <div className="min-w-0 flex-1 self-stretch">
      <div className="flex h-11 items-center gap-3 pr-16">
        <span aria-hidden className="size-2 shrink-0 rounded-full border border-terminal-muted"/>
        <button type="button" onClick={() => window.dispatchEvent(new Event("atlas:search"))} title={symbolName} className="widget-no-drag flex min-w-0 items-center gap-2 text-left hover:text-terminal-accent-soft">
          <span className="text-[16px] font-medium">{symbol}</span><span className="text-[11px] text-terminal-muted">{currency}</span><ChevronDown className="size-3 text-terminal-muted"/>
        </button>
        <div className="min-w-0 text-[13px] tabular-nums">
          <span className="whitespace-nowrap">{candle ? money(quote.price || candle.close) : "—"}</span>
          <span className={`ml-2 hidden text-[11px] xl:inline ${tone}`}>{candle ? `${quote.change >= 0 ? "+" : ""}${money(quote.change)} (${quote.changePercent.toFixed(2)}%)` : ""}</span>
        </div>
        <div ref={ref} className="widget-no-drag relative ml-auto flex shrink-0 items-center gap-2">
          <button type="button" aria-label="Sembol ara" onClick={() => window.dispatchEvent(new Event("atlas:search"))} className="rounded p-1.5 hover:bg-terminal-hover"><Search className="size-4"/></button>
          <span aria-hidden className="hidden sm:inline"><CandlestickChart className="size-4"/></span>
          <button type="button" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} className="flex items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-terminal-hover"><SlidersHorizontal className="size-4"/><span className="hidden lg:inline">İndikatörler</span></button>
          {menuOpen ? <div role="group" aria-label="İndikatörler" className="absolute top-full right-0 z-40 w-48 rounded border border-terminal-border bg-terminal-elevated p-2 shadow-xl">
            {([['volume', 'Hacim'], ['lastPriceLine', 'Son fiyat çizgisi']] as const).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-3 p-2 text-[12px]"><span>{label}</span><input type="checkbox" checked={indicators[key]} onChange={() => dispatch(toggleIndicator(key))} className="accent-terminal-accent"/></label>)}
          </div> : null}
        </div>
      </div>
      <div className="flex h-10 items-center gap-2 overflow-hidden border-t border-terminal-border/50">
        <div className="widget-no-drag flex shrink-0 gap-2">
          <button type="button" onClick={onBuy} className="h-6 w-16 rounded bg-terminal-up/15 text-[12px] font-medium text-terminal-up hover:bg-terminal-up/25">Al</button>
          <button type="button" onClick={onSell} className="h-6 w-16 rounded bg-terminal-down/15 text-[12px] font-medium text-terminal-down hover:bg-terminal-down/25">Sat</button>
        </div>
        {candle ? <div aria-live="off" className={`ml-1 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] whitespace-nowrap tabular-nums ${isHovering ? "opacity-100" : "opacity-85"}`}>
          {([['A', candle.open], ['Y', candle.high], ['D', candle.low], ['K', candle.close], ['H', candle.volume]] as const).map(([label, value]) => <span key={label} className="inline-flex gap-1"><span className="text-terminal-muted">{label}</span><span className={tone}>{label === 'H' ? formatVolume(value) : formatPrice(value, { suffix: '' })}</span></span>)}
        </div> : null}
      </div>
    </div>
  );
}
