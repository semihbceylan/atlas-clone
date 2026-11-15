"use client";

import { useEffect, useState } from "react";
import { validateDrawings, type Drawing } from "@/lib/chart/drawings";

const key = (symbol: string) => `terminal-lab.drawings.v1.${symbol}`;
export function useDrawings(symbol: string) {
  const [state, setState] = useState<{ scope: string; rows: Drawing[]; past: Drawing[][]; future: Drawing[][]; ready: boolean }>({ scope: symbol, rows: [], past: [], future: [], ready: false });
  useEffect(() => {
    let rows: Drawing[] = [];
    try { rows = validateDrawings(JSON.parse(localStorage.getItem(key(symbol)) ?? "[]")); } catch { /* Storage is optional. */ }
    // Loading an external browser store is intentionally done after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ scope: symbol, rows, past: [], future: [], ready: true });
  }, [symbol]);
  useEffect(() => {
    if (!state.ready || state.scope !== symbol) return;
    try { localStorage.setItem(key(symbol), JSON.stringify(state.rows)); } catch { /* Quota/private mode. */ }
  }, [state, symbol]);
  const rows = state.scope === symbol ? state.rows : [];
  return {
    rows,
    ready: state.ready && state.scope === symbol,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit: (next: Drawing[]) => setState(current => current.scope !== symbol || !current.ready ? current : ({ ...current, rows: next, past: [...current.past.slice(-49), current.rows], future: [] })),
    undo: () => setState(current => !current.past.length ? current : ({ ...current, rows: current.past[current.past.length - 1], past: current.past.slice(0, -1), future: [current.rows, ...current.future] })),
    redo: () => setState(current => !current.future.length ? current : ({ ...current, rows: current.future[0], past: [...current.past, current.rows], future: current.future.slice(1) })),
  };
}
