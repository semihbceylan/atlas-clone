"use client";

import { Briefcase, Trash } from "lucide-react";

import { getSymbolInfo } from "@/config/market-symbols";
import { WidgetFrame } from "@/components/terminal/widget-frame";
import { IconButton } from "@/components/terminal/icon-button";
import { useLivePrice } from "@/hooks/use-live-candles";
import type { LiveMarketApi } from "@/hooks/use-live-candles";
import { formatPercent, formatPrice } from "@/lib/format-price";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { applyFill, selectPositions } from "@/store/slices/terminal-slice";
import type { Position } from "@/types/market";

interface PositionsWidgetProps {
  /** Live-market handle; the widget subscribes to the price it needs itself. */
  api: LiveMarketApi;
}

interface PositionRow extends Position {
  /** Price used for the mark-to-market calculation. */
  currentPrice: number;
  /** Whether `currentPrice` came from the live feed or a static entry price. */
  isLive: boolean;
}

/**
 * "Pozisyonlar" widget.
 *
 * Renders the reference's centered empty state until the user presses Al/Sat on
 * the chart, at which point simulated fills appear here and are marked to market
 * against the live price.
 *
 * It subscribes to the price directly instead of receiving it from the terminal
 * shell: that keeps per-tick re-renders inside this widget rather than bubbling
 * up to the whole dashboard.
 */
export function PositionsWidget({ api }: PositionsWidgetProps) {
  const dispatch = useAppDispatch();
  const positions = useAppSelector(selectPositions);
  const price = useLivePrice(api);
  const liveSymbol = api.symbol;
  const livePrice = price.price;

  const rows: PositionRow[] = positions.map((position) => {
    // Only the selected instrument streams, so other positions are marked at
    // their entry price (P&L 0) rather than showing a stale number.
    const isLive = position.symbol === liveSymbol && Number.isFinite(livePrice) && livePrice > 0;
    return {
      ...position,
      currentPrice: isLive ? livePrice : position.averagePrice,
      isLive,
    };
  });

  return (
    <WidgetFrame
      title="Pozisyonlar"
      actions={
        <span
          className="text-[11px] text-terminal-muted"
        >
          {rows.length > 0 ? `${rows.length} pozisyon · Demo` : ""}
        </span>
      }
    >
      {rows.length === 0 ? (
        <div className="flex h-full flex-col">
          <div className="flex h-10 shrink-0 items-center gap-8 overflow-hidden px-4 text-[12px] whitespace-nowrap text-terminal-muted">
            <span>Varlık</span><span>Adet</span><span>Fiyat</span><span>Ort. Maliyet</span>
          </div>
          <div className="min-h-0 flex-1"><PositionsEmptyState /></div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="grid grid-cols-[1.1fr_0.7fr_1fr_0.9fr_auto] gap-1 border-b border-terminal-border px-3 py-1.5 text-[10px] font-medium tracking-wide text-terminal-subtle uppercase">
            <span>Varlık</span>
            <span className="text-right">Adet</span>
            <span className="text-right">Ort. Fiyat</span>
            <span className="text-right">K/Z</span>
            <span className="w-5" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((row) => {
              const pnl = (row.currentPrice - row.averagePrice) * row.quantity;
              const pnlPercent = row.averagePrice === 0 ? 0 : (pnl / (row.averagePrice * Math.abs(row.quantity))) * 100;

              return (
                <div
                  title={getSymbolInfo(row.symbol).currency}
                  key={row.id}
                  className="group grid grid-cols-[1.1fr_0.7fr_1fr_0.9fr_auto] items-center gap-1 border-b border-terminal-border/60 px-3 py-1.5 hover:bg-terminal-hover/60"
                >
                  <span className="truncate text-[11.5px] font-semibold text-terminal-text">
                    {row.symbol}
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-terminal-muted">
                    {row.quantity}
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-terminal-muted">
                    {formatPrice(row.averagePrice, { suffix: "" })}
                  </span>
                  <span
                    className={`text-right font-mono text-[11px] tabular-nums ${
                      pnl > 0 ? "text-terminal-up" : pnl < 0 ? "text-terminal-down" : "text-terminal-muted"
                    }`}
                    title={`${formatPercent(pnlPercent)} · ${getSymbolInfo(row.symbol).currency}`}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {formatPrice(pnl, { suffix: "" })}
                  </span>
                  <IconButton
                    label={`${row.symbol} pozisyonunu kapat`}
                    icon={<Trash className="size-3.5" />}
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() =>
                      dispatch(
                        applyFill({
                          symbol: row.symbol,
                          quantity: -row.quantity,
                          price: row.currentPrice,
                        }),
                      )
                    }
                  />
                </div>
              );
            })}
          </div>

          {rows.some((row) => !row.isLive) ? (
            <p className="border-t border-terminal-border px-3 py-1 text-[10px] text-terminal-subtle">
              Yalnızca seçili sembolün fiyatı canlı akar; diğer satırlar giriş
              fiyatından işaretlenir.
            </p>
          ) : null}
        </div>
      )}
    </WidgetFrame>
  );
}

function PositionsEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
      <span className="flex size-9 items-center justify-center rounded-full border border-terminal-border bg-terminal-panel-alt">
        <Briefcase className="size-4 text-terminal-subtle" />
      </span>
      <p className="text-[13px] font-medium text-terminal-text">
        Yatırım pozisyonun bulunmuyor
      </p>
      <p className="max-w-[260px] text-[12px] leading-relaxed text-terminal-muted">
        Hesabında yatırım varlığın bulunmuyor. Yatırım yaptıkça varlıklarını burada görebilirsin.
      </p>
    </div>
  );
}
