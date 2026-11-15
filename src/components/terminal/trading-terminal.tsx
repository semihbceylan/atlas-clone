"use client";

import { useMemo, useState } from "react";
import { PriceAlerts } from "./price-alerts";
import { useHydrated } from "@/hooks/use-hydrated";
import { NewsWidget } from "@/components/widgets/news-widget";

import { DashboardGrid } from "@/components/terminal/dashboard-grid";
import { TerminalHeader } from "@/components/terminal/terminal-header";
import { ChartWidget } from "@/components/widgets/chart-widget";
import { PositionsWidget } from "@/components/widgets/positions-widget";
import { WatchlistWidget } from "@/components/widgets/watchlist-widget";
import { ScreenerWidget, OrdersWidget, PortfolioWidget, DetailsWidget } from "@/components/widgets/local-modules";
import { WIDGET_IDS, type WidgetId } from "@/config/default-layout";
import { useLiveCandles } from "@/hooks/use-live-candles";
import { useAppSelector } from "@/store/hooks";
import { selectSelectedSymbol, selectTimeframe } from "@/store/slices/terminal-slice";
import type { ReactNode } from "react";

/**
 * The terminal's single client boundary.
 *
 * It owns exactly one live-market handle per symbol/timeframe pair and hands it
 * to the header and the chart. Because `useLiveCandles` stores market data in a
 * ref-based state object rather than React state, this component only re-renders
 * when the user changes the symbol, timeframe, or layout — never on a price tick.
 */
export function TradingTerminal() {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const hydrated = useHydrated();
  const symbol = useAppSelector(selectSelectedSymbol);
  const timeframe = useAppSelector(selectTimeframe);

  const api = useLiveCandles(symbol, timeframe);

  // Memoised so the grid's children keep a stable identity: a price tick must
  // not re-render every widget. Each widget subscribes to what it needs.
  const widgets = useMemo<Record<WidgetId, ReactNode>>(
    () => ({
      [WIDGET_IDS.chart]: <ChartWidget api={api} />,
      [WIDGET_IDS.positions]: <PositionsWidget api={api} />,
      [WIDGET_IDS.watchlist]: <WatchlistWidget api={api} />,
      screener: <ScreenerWidget />,
      orders: <OrdersWidget />,
      portfolio: <PortfolioWidget api={api} />,
      details: <DetailsWidget api={api} />,
      news: <NewsWidget />,
    }),
    [api],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-terminal-bg">
      <TerminalHeader onAlerts={() => setAlertsOpen(true)} />
      {hydrated ? <PriceAlerts api={api} open={alertsOpen} onClose={() => setAlertsOpen(false)}/> : null}
      <DashboardGrid widgets={widgets} />
      <footer className="flex min-h-6 shrink-0 flex-wrap items-center justify-between gap-x-3 border-t border-terminal-border px-3 py-1 text-[10px] text-terminal-muted">
        <span>Independent portfolio demo · Not affiliated with Midas · Simulated orders</span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="hover:text-terminal-text">TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.</a>
      </footer>
    </div>
  );
}
