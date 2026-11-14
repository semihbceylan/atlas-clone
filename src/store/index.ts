import { configureStore } from "@reduxjs/toolkit";
import { terminalReducer } from "@/store/slices/terminal-slice";

/**
 * Typed Redux store.
 *
 * The store lives in a module singleton, which means it is shared between the
 * server render and the first client render. Because every slice starts from a
 * deterministic initial state (no `localStorage`, no `Date.now()`), the server
 * and client agree and hydration stays clean.
 */
export const makeStore = () =>
  configureStore({
    reducer: {
      terminal: terminalReducer,
    },
  });

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
