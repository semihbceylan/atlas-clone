import type { Layout } from "react-grid-layout";

/**
 * Dashboard grid configuration and the default widget arrangement.
 *
 * The grid mirrors the reference terminal at ~1660×910: a ~75%-wide chart that
 * spans almost the full height, with positions and watchlist stacked in the
 * remaining right-hand column. Rows are deliberately tall (62px) so the default
 * 12-row chart height maps to roughly 830px of usable canvas.
 */

export const GRID_COLS = 48;
export const GRID_ROWS = 24;
export const GRID_ROW_HEIGHT = 62;
export const GRID_MARGIN: [number, number] = [2, 2];
export const GRID_CONTAINER_PADDING: [number, number] = [1, 1];

/** Identifiers are stable — they are the keys persisted in localStorage. */
export const WIDGET_IDS = {
  chart: "chart",
  positions: "positions",
  watchlist: "watchlist",
  screener: "screener",
  portfolio: "portfolio",
  orders: "orders",
  details: "details",
  news: "news",
} as const;

export type WidgetId = (typeof WIDGET_IDS)[keyof typeof WIDGET_IDS];

/** Minimum footprint in the shared 48-column, 24-row workspace grid. */
export const WIDGET_MIN_SIZE: Record<WidgetId, { minW: number; minH: number }> = {
  chart: { minW: 16, minH: 12 },
  positions: { minW: 10, minH: 6 },
  watchlist: { minW: 8, minH: 6 },
  screener: { minW: 16, minH: 8 },
  portfolio: { minW: 10, minH: 10 },
  orders: { minW: 14, minH: 6 },
  details: { minW: 10, minH: 8 },
  news: { minW: 10, minH: 8 },
};

export const WIDGET_LABELS: Record<WidgetId, string> = {
  chart: "Grafik",
  positions: "Pozisyonlar",
  watchlist: "Takip Ettiklerim",
  screener: "Hisse tarayıcı",
  portfolio: "Portföy",
  orders: "Emir geçmişi",
  details: "Varlık detayı",
  news: "Haberler",
};

export const ALL_WIDGET_IDS: readonly WidgetId[] = Object.values(WIDGET_IDS);

/** Default layout requested by the brief: chart 9×12, right column 3 wide. */
export const DEFAULT_LAYOUT: Layout = [
  {
    i: WIDGET_IDS.chart,
    x: 0,
    y: 0,
    w: 9,
    h: 12,
    minW: 5,
    minH: 8,
  },
  {
    i: WIDGET_IDS.positions,
    x: 9,
    y: 0,
    w: 3,
    h: 6,
    minW: 2,
    minH: 4,
  },
  {
    i: WIDGET_IDS.watchlist,
    x: 9,
    y: 6,
    w: 3,
    h: 6,
    minW: 2,
    minH: 4,
  },
].map(item => ({ ...item, x: item.x * 4, w: item.w * 4, minW: item.minW * 4, y: item.y * 2, h: item.h * 2, minH: item.minH * 2 }));

/** Selector for the only element allowed to start a widget drag. */
export const GRID_DRAG_HANDLE = ".widget-drag-handle";

/** Selector for interactive header controls that must never start a drag. */
export const GRID_DRAG_CANCEL = ".widget-no-drag";
