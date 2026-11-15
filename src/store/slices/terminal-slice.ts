import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Position, Timeframe, WatchlistItem } from "@/types/market";
import { DEFAULT_SYMBOL } from "@/config/market-symbols";
import { ALL_WIDGET_IDS, type WidgetId } from "@/config/default-layout";

/**
 * Low-frequency terminal state only.
 *
 * High-frequency data (ticks, candles, the live price) deliberately lives in the
 * market-feed layer instead: dispatching ~2 actions/second through Redux would
 * re-render every connected component and throw away the chart's incremental
 * update path. Redux owns *choices* — symbol, timeframe, watchlist, UI prefs.
 */

/** Tools available in the chart's left-hand drawing toolbar. */
export type DrawingTool =
  | "cursor"
  | "crosshair"
  | "trend-line"
  | "horizontal-line"
  | "ray"
  | "rectangle"
  | "fibonacci"
  | "text"
  | "measure"
  | "magnet"
  | "eraser";

export interface TerminalState {
  visibleModules: WidgetId[];
  orders: { id: string; symbol: string; quantity: number; price: number; createdAt: string }[];
  /** Symbol currently loaded in the chart. */
  selectedSymbol: string;
  /** Active chart interval. */
  timeframe: Timeframe;
  /** Symbols the user follows. Empty on first load, matching the reference. */
  watchlist: WatchlistItem[];
  watchlists: { id: string; name: string; items: WatchlistItem[] }[];
  activeWatchlist: string;
  /**
   * Demo positions opened from the chart's Al/Sat buttons. Starts empty so the
   * widget renders its empty state, exactly like the reference screenshot.
   */
  positions: Position[];
  /** Monotonic id source, kept in state so reducers stay pure. */
  positionSequence: number;
  /** Active drawing tool (visual only in this MVP). */
  activeDrawingTool: DrawingTool;
  /** Header toggle for the "Göstergeler" menu. */
  indicators: {
    volume: boolean;
    lastPriceLine: boolean;
  };
  /**
   * Bumped by the header's overflow menu to ask the grid to restore the default
   * layout. A counter (rather than a boolean) means repeated resets each produce
   * a distinct state change the grid can react to.
   */
  layoutResetToken: number;
}

const initialState: TerminalState = {
  visibleModules: ["chart", "positions", "watchlist"],
  orders: [],
  selectedSymbol: DEFAULT_SYMBOL,
  timeframe: "5m",
  watchlist: [],
  watchlists: [{ id: "default", name: "Takip Ettiklerim", items: [] }],
  activeWatchlist: "default",
  positions: [],
  positionSequence: 0,
  activeDrawingTool: "cursor",
  indicators: {
    volume: true,
    lastPriceLine: true,
  },
  layoutResetToken: 0,
};

const terminalSlice = createSlice({
  name: "terminal",
  initialState,
  reducers: {
    restoreWatchlists(state, action: PayloadAction<unknown>) {
      const value = action.payload as { lists?: unknown; active?: unknown } | null;
      if (!value || !Array.isArray(value.lists)) return;
      const lists = value.lists.filter((list): list is TerminalState["watchlists"][number] => !!list && typeof list.id === "string" && typeof list.name === "string" && Array.isArray(list.items) && list.items.every((item: WatchlistItem) => item && typeof item.symbol === "string" && typeof item.name === "string" && Number.isFinite(item.price) && Number.isFinite(item.changePercent))).slice(0, 20);
      if (!lists.length || new Set(lists.map(list => list.id)).size !== lists.length) return;
      state.watchlists = lists;
      state.activeWatchlist = lists.some(list => list.id === value.active) ? value.active as string : lists[0].id;
      state.watchlist = lists.find(list => list.id === state.activeWatchlist)!.items;
    },
    createWatchlist(state, action: PayloadAction<{ id: string; name: string }>) {
      if (!action.payload.name.trim() || state.watchlists.length >= 20 || state.watchlists.some(list => list.id === action.payload.id)) return;
      const current = state.watchlists.find(list => list.id === state.activeWatchlist);
      if (current) current.items = state.watchlist;
      state.watchlists.push({ ...action.payload, name: action.payload.name.trim().slice(0, 60), items: [] });
      state.activeWatchlist = action.payload.id;
      state.watchlist = [];
    },
    selectWatchlistById(state, action: PayloadAction<string>) {
      const next = state.watchlists.find(list => list.id === action.payload);
      if (!next) return;
      const current = state.watchlists.find(list => list.id === state.activeWatchlist);
      if (current) current.items = state.watchlist;
      state.activeWatchlist = next.id;
      state.watchlist = next.items;
    },
    renameWatchlist(state, action: PayloadAction<string>) {
      const current = state.watchlists.find(list => list.id === state.activeWatchlist);
      if (current && action.payload.trim()) current.name = action.payload.trim().slice(0, 60);
    },
    deleteWatchlist(state) {
      if (state.watchlists.length <= 1) return;
      state.watchlists = state.watchlists.filter(list => list.id !== state.activeWatchlist);
      state.activeWatchlist = state.watchlists[0].id;
      state.watchlist = state.watchlists[0].items;
    },
    restoreModules(state, action: PayloadAction<unknown>) {
      if (!Array.isArray(action.payload)) return;
      state.visibleModules = ALL_WIDGET_IDS.filter(id => (action.payload as unknown[]).includes(id));
    },
    toggleModule(state, action: PayloadAction<WidgetId>) {
      state.visibleModules = state.visibleModules.includes(action.payload)
        ? state.visibleModules.filter(id => id !== action.payload)
        : [...state.visibleModules, action.payload];
    },
    setSelectedSymbol(state, action: PayloadAction<string>) {
      state.selectedSymbol = action.payload;
    },
    setTimeframe(state, action: PayloadAction<Timeframe>) {
      state.timeframe = action.payload;
    },
    /** Idempotent: re-adding a symbol only refreshes its row. */
    addToWatchlist(state, action: PayloadAction<WatchlistItem>) {
      const existing = state.watchlist.findIndex((item) => item.symbol === action.payload.symbol);
      if (existing >= 0) {
        state.watchlist[existing] = action.payload;
        return;
      }
      state.watchlist.push(action.payload);
    },
    removeFromWatchlist(state, action: PayloadAction<string>) {
      state.watchlist = state.watchlist.filter((item) => item.symbol !== action.payload);
    },
    /**
     * Applies a simulated fill. Buys and sells on the same symbol net into one
     * weighted-average position, which is how a real position ledger behaves.
     */
    applyFill: {
      prepare(fill: { symbol: string; quantity: number; price: number }) {
        return { payload: { ...fill, createdAt: new Date().toISOString() } };
      },
      reducer(state, action: PayloadAction<{ symbol: string; quantity: number; price: number; createdAt: string }>) {
      const { symbol, quantity, price } = action.payload;
      if (!Number.isFinite(quantity) || quantity === 0 || !Number.isFinite(price) || price <= 0) return;
      state.orders.unshift({ ...action.payload, id: `order-${state.orders.length + 1}` });

      const existing = state.positions.find((position) => position.symbol === symbol);

      if (!existing) {
        state.positionSequence += 1;
        state.positions.push({
          id: `position-${state.positionSequence}`,
          symbol,
          quantity,
          averagePrice: price,
          unrealizedPnl: 0,
        });
        return;
      }

      const nextQuantity = existing.quantity + quantity;

      // A position that nets to zero is closed and removed from the ledger.
      if (nextQuantity === 0) {
        state.positions = state.positions.filter((position) => position.symbol !== symbol);
        return;
      }

      // Averaging only makes sense when adding to the same side of the book.
      const sameDirection = Math.sign(existing.quantity) === Math.sign(quantity);
      existing.averagePrice = sameDirection
        ? (existing.averagePrice * existing.quantity + price * quantity) / nextQuantity
        : Math.sign(nextQuantity) === Math.sign(existing.quantity) ? existing.averagePrice : price;
      existing.quantity = nextQuantity;
      },
    },
    setActiveDrawingTool(state, action: PayloadAction<DrawingTool>) {
      state.activeDrawingTool = action.payload;
    },
    toggleIndicator(state, action: PayloadAction<keyof TerminalState["indicators"]>) {
      const key = action.payload;
      state.indicators[key] = !state.indicators[key];
    },
    requestLayoutReset(state) {
      state.layoutResetToken += 1;
    },
  },
});

export const {
  setSelectedSymbol,
  setTimeframe,
  addToWatchlist,
  removeFromWatchlist,
  applyFill,
  setActiveDrawingTool,
  toggleIndicator,
  requestLayoutReset,
  toggleModule,
  restoreModules,
  restoreWatchlists, createWatchlist, selectWatchlistById, renameWatchlist, deleteWatchlist,
} = terminalSlice.actions;

export const terminalReducer = terminalSlice.reducer;

/** Convenience selectors — colocated so slices stay the single source of truth. */
export const selectSelectedSymbol = (state: { terminal: TerminalState }) =>
  state.terminal.selectedSymbol;
export const selectTimeframe = (state: { terminal: TerminalState }) => state.terminal.timeframe;
export const selectWatchlist = (state: { terminal: TerminalState }) => state.terminal.watchlist;
export const selectPositions = (state: { terminal: TerminalState }) => state.terminal.positions;
export const selectActiveDrawingTool = (state: { terminal: TerminalState }) =>
  state.terminal.activeDrawingTool;
export const selectIndicators = (state: { terminal: TerminalState }) => state.terminal.indicators;
export const selectLayoutResetToken = (state: { terminal: TerminalState }) =>
  state.terminal.layoutResetToken;
