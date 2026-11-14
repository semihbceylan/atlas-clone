"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, RotateCcw } from "lucide-react";

import { CandlestickChart } from "@/components/chart/candlestick-chart";
import { ChartFooter } from "@/components/chart/chart-footer";
import { ChartHeader } from "@/components/chart/chart-header";
import { DrawingToolbar } from "@/components/chart/drawing-toolbar";
import { IconButton } from "@/components/terminal/icon-button";
import { WidgetFrame } from "@/components/terminal/widget-frame";
import { getSymbolInfo } from "@/config/market-symbols";
import type { LiveMarketApi } from "@/hooks/use-live-candles";
import { useLivePrice } from "@/hooks/use-live-candles";
import { COINBASE_PRODUCTS } from "@/lib/market/create-coinbase-feed";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  applyFill,
  selectActiveDrawingTool,
  selectIndicators,
  selectSelectedSymbol,
  selectTimeframe,
  setActiveDrawingTool,
  setTimeframe,
} from "@/store/slices/terminal-slice";
import type { Candle } from "@/types/market";

interface ChartWidgetProps {
  /** Shared live-market handle owned by `TradingTerminal`. */
  api: LiveMarketApi;
}

/** Simulated order size used by the Al/Sat buttons. */
const DEMO_ORDER_SIZE = 100;

/** Last candle of a series, or `null` when the series is empty. */
function lastCandleOf(candles: readonly Candle[]): Candle | null {
  return candles[candles.length - 1] ?? null;
}

/**
 * Chart widget: the OHLC readout, the canvas, the drawing rail and the interval
 * toolbar.
 *
 * State ownership is deliberate:
 * - symbol / timeframe / active tool / indicator toggles live in Redux (rarely
 *   change, and other widgets read them);
 * - hovered and latest candle live in local state, because they change with the
 *   tape and nothing outside this widget needs them.
 */
export function ChartWidget({ api }: ChartWidgetProps) {
  const dispatch = useAppDispatch();
  const quote = useLivePrice(api);
  const symbol = useAppSelector(selectSelectedSymbol);
  const timeframe = useAppSelector(selectTimeframe);
  const activeTool = useAppSelector(selectActiveDrawingTool);
  const indicators = useAppSelector(selectIndicators);

  const [lastAction, setLastAction] = useState<string | null>(null);
  /** Incremented by the "rescale" header button to re-fit the visible range. */
  const [viewResetToken, setViewResetToken] = useState(0);

  // `api` changes only when the symbol or timeframe changes, so it doubles as the
  // scope key for the per-instrument view state below. Deriving during render
  // (instead of resetting from an effect) avoids a wasted render pass and keeps
  // the mutable market controller out of the render phase entirely.
  const [view, setView] = useState<{
    scope: LiveMarketApi;
    latest: Candle | null;
    hovered: Candle | null;
  }>(() => ({ scope: api, latest: lastCandleOf(api.initial.candles), hovered: null }));

  const latestCandle = view.scope === api ? view.latest : lastCandleOf(api.initial.candles);
  const hoveredCandle = view.scope === api ? view.hovered : null;

  // Subscribe to the incremental candle stream. Updates go straight to local
  // state; the canvas itself is updated imperatively by `CandlestickChart`.
  useEffect(() => {
    return api.subscribe((event) => {
      const candle =
        event.type === "reset" ? lastCandleOf(event.candles) : event.candle;

      setView((current) => ({
        scope: api,
        latest: candle,
        // A symbol/timeframe switch invalidates any hovered candle.
        hovered: current.scope === api ? current.hovered : null,
      }));
    });
  }, [api]);

  const handleCrosshairMove = useCallback(
    (candle: Candle | null) => {
      setView((current) => ({ ...current, scope: api, hovered: candle }));
    },
    [api],
  );

  const handleFill = useCallback(
    (side: "buy" | "sell") => {
      const candle = latestCandle;
      if (!candle) return;

      const orderSize = COINBASE_PRODUCTS[symbol] ? 0.01 : DEMO_ORDER_SIZE;
      const quantity = side === "buy" ? orderSize : -orderSize;
      dispatch(applyFill({ symbol, quantity, price: candle.close }));
      setLastAction(
        `${symbol} · ${orderSize} adet ${side === "buy" ? "alış" : "satış"} simüle edildi`,
      );
    },
    [dispatch, latestCandle, symbol],
  );

  // Clear the transient order confirmation after a beat.
  useEffect(() => {
    if (!lastAction) return;
    const timer = setTimeout(() => setLastAction(null), 2_400);
    return () => clearTimeout(timer);
  }, [lastAction]);

  const symbolInfo = getSymbolInfo(symbol);
  const activeCandle = hoveredCandle ?? latestCandle;

  const headerActions = (
    <>
      <IconButton
        label="Grafiği yeniden ölçekle"
        icon={<RotateCcw className="size-3.5" />}
        size="sm"
        onClick={() => setViewResetToken((token) => token + 1)}
      />
      <IconButton label="Tam ekran" icon={<Maximize2 className="size-3.5" />} size="sm" onClick={(event) => {
        const panel = event.currentTarget.closest("section");
        const action = document.fullscreenElement ? document.exitFullscreen() : panel?.requestFullscreen();
        void action?.catch(() => {});
      }} />
    </>
  );

  return (
    <WidgetFrame
      ariaLabel="Fiyat grafiği"
      className="chart-panel"
      title={
        <ChartHeader
          quote={quote}
          symbol={symbol}
          symbolName={symbolInfo.name}
          timeframe={timeframe}
          candle={activeCandle}
          isHovering={hoveredCandle !== null}
          onBuy={() => handleFill("buy")}
          onSell={() => handleFill("sell")}
        />
      }
      actions={headerActions}
      bodyClassName="flex flex-col overflow-hidden"
    >
      <div className="relative min-h-0 flex-1">
        <DrawingToolbar
          activeTool={activeTool}
          onSelectTool={(tool) => dispatch(setActiveDrawingTool(tool))}
          onClear={() => dispatch(setActiveDrawingTool("cursor"))}
        />

        {/* Left padding reserves room for the drawing rail. */}
        <div className="absolute inset-0 pl-9">
          <CandlestickChart
            api={api}
            timeframe={timeframe}
            showVolume={indicators.volume}
            showLastPriceLine={indicators.lastPriceLine}
            crosshairSnapped={activeTool === "magnet"}
            onCrosshairMove={handleCrosshairMove}
            viewResetToken={viewResetToken}
          />
        </div>

        {lastAction ? (
          <div
            role="status"
            className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-md border border-terminal-border-strong bg-terminal-elevated px-3 py-1.5 text-[11px] text-terminal-text shadow-lg"
          >
            {lastAction}
          </div>
        ) : null}
      </div>

      <ChartFooter
        crosshairSnapped={activeTool === "magnet"}
        onToggleSnap={() => dispatch(setActiveDrawingTool(activeTool === "magnet" ? "cursor" : "magnet"))}
        status={quote.status}
        timeframe={timeframe}
        onTimeframeChange={(next) => dispatch(setTimeframe(next))}
        isHovering={hoveredCandle !== null}
      />
    </WidgetFrame>
  );
}
