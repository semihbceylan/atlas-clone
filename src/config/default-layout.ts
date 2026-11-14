import type { Layout } from "react-grid-layout";

/**
 * Dashboard grid configuration and the default widget arrangement.
 *
 * The grid mirrors the reference terminal at ~1660×910: a ~75%-wide chart that
 * spans almost the full height, with positions and watchlist stacked in the
 * remaining right-hand column. Rows are deliberately tall (62px) so the default
 * 12-row chart height maps to roughly 830px of usable canvas.
 */

export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 62;
export const GRID_MARGIN: [number, number] = [2, 2];
export const GRID_CONTAINER_PADDING: [number, number] = [1, 1];

/** Identifiers are stable — they are the keys persisted in localStorage. */
export const WIDGET_IDS = {
  chart: "chart",
  positions: "positions",
  watchlist: "watchlist",
} as const;

export type WidgetId = (typeof WIDGET_IDS)[keyof typeof WIDGET_IDS];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  chart: "Grafik",
  positions: "Pozisyonlar",
  watchlist: "Takip Ettiklerim",
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
];

/** Selector for the only element allowed to start a widget drag. */
export const GRID_DRAG_HANDLE = ".widget-drag-handle";

/** Selector for interactive header controls that must never start a drag. */
export const GRID_DRAG_CANCEL = ".widget-no-drag";
