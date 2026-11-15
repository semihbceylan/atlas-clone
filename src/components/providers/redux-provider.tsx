"use client";

import { Provider } from "react-redux";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { store } from "@/store";
import { restoreModules, restoreWatchlists, setPreference } from "@/store/slices/terminal-slice";

/**
 * Client boundary for Redux.
 *
 * The store is a module singleton with a fully deterministic initial state, so
 * the server render and the first client render produce identical output and
 * hydration stays clean. Everything above this component (root layout, page)
 * remains a Server Component.
 */
export function ReduxProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = "terminal-lab.modules.v1";
    try { const saved = localStorage.getItem(key); if (saved) store.dispatch(restoreModules(JSON.parse(saved))); } catch { /* Optional browser storage. */ }
    try { const saved = localStorage.getItem("terminal-lab.watchlists.v1"); if (saved) store.dispatch(restoreWatchlists(JSON.parse(saved))); } catch { /* Optional browser storage. */ }
    try { const saved = JSON.parse(localStorage.getItem("terminal-lab.preferences.v1") ?? "{}"); for (const key of ["lightTheme", "hideAmounts"] as const) if (typeof saved[key] === "boolean") store.dispatch(setPreference({ key, value: saved[key] })); } catch { /* Optional browser storage. */ }
    const syncPreferences = () => { const prefs = store.getState().terminal.preferences; document.documentElement.dataset.theme = prefs.lightTheme ? "light" : "dark"; document.documentElement.dataset.hideAmounts = String(prefs.hideAmounts); };
    syncPreferences();
    let previousPreferences = store.getState().terminal.preferences;
    let previous = store.getState().terminal.visibleModules;
    let previousLists = store.getState().terminal.watchlists;
    let previousItems = store.getState().terminal.watchlist;
    let previousActive = store.getState().terminal.activeWatchlist;
    return store.subscribe(() => {
      const state = store.getState().terminal;
      const modules = state.visibleModules;
      if (state.preferences !== previousPreferences) {
        previousPreferences = state.preferences; syncPreferences();
        try { localStorage.setItem("terminal-lab.preferences.v1", JSON.stringify(state.preferences)); } catch { /* Optional browser storage. */ }
      }
      if (state.watchlists !== previousLists || state.watchlist !== previousItems || state.activeWatchlist !== previousActive) {
        previousLists = state.watchlists; previousItems = state.watchlist; previousActive = state.activeWatchlist;
        try { localStorage.setItem("terminal-lab.watchlists.v1", JSON.stringify({ active: state.activeWatchlist, lists: state.watchlists.map(list => list.id === state.activeWatchlist ? { ...list, items: state.watchlist } : list) })); } catch { /* Optional browser storage. */ }
      }
      if (modules === previous) return;
      previous = modules;
      try { localStorage.setItem(key, JSON.stringify(modules)); } catch { /* Optional browser storage. */ }
    });
  }, []);
  return <Provider store={store}>{children}</Provider>;
}
