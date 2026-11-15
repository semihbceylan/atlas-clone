import { describe, expect, it } from "vitest";
import { applyFill, terminalReducer, toggleModule, createWatchlist, selectWatchlistById, renameWatchlist, deleteWatchlist, addToWatchlist, restoreWatchlists } from "./terminal-slice";
import { WATCHLIST_CATALOG } from "@/config/market-symbols";

describe("local modules and simulated fills", () => {
  it("keeps separate watchlist contents across switching and deletion", () => {
    let state = terminalReducer(undefined, addToWatchlist(WATCHLIST_CATALOG[0]));
    state = terminalReducer(state, createWatchlist({ id: "second", name: "Crypto" }));
    expect(state.watchlist).toEqual([]);
    state = terminalReducer(state, renameWatchlist("My list"));
    expect(state.watchlists[1].name).toBe("My list");
    state = terminalReducer(state, selectWatchlistById("default"));
    expect(state.watchlist).toEqual([WATCHLIST_CATALOG[0]]);
    state = terminalReducer(state, deleteWatchlist());
    expect(state.activeWatchlist).toBe("second");
    expect(terminalReducer(state, deleteWatchlist()).watchlists).toHaveLength(1);
  });
  it("rejects malformed saved lists", () => {
    expect(terminalReducer(undefined, restoreWatchlists({ lists: [null] })).watchlists).toHaveLength(1);
  });
  it("adds/removes modules without duplicates", () => {
    const state = terminalReducer(undefined, toggleModule("screener"));
    expect(state.visibleModules).toContain("screener");
    expect(terminalReducer(state, toggleModule("screener")).visibleModules).not.toContain("screener");
  });
  it("records fills and preserves cost basis on partial closes", () => {
    let state = terminalReducer(undefined, applyFill({ symbol: "BTC", price: 100, quantity: 10 }));
    state = terminalReducer(state, applyFill({ symbol: "BTC", price: 120, quantity: -5 }));
    expect(state.positions[0]).toMatchObject({ quantity: 5, averagePrice: 100 });
    expect(state.orders).toHaveLength(2);
    state = terminalReducer(state, applyFill({ symbol: "BTC", price: 130, quantity: -10 }));
    expect(state.positions[0]).toMatchObject({ quantity: -5, averagePrice: 130 });
  });
  it("rejects invalid fills", () => {
    const state = terminalReducer(undefined, applyFill({ symbol: "BTC", price: -1, quantity: 10 }));
    expect(state.orders).toEqual([]);
  });
});
