"use client";

import { Provider } from "react-redux";
import type { ReactNode } from "react";
import { store } from "@/store";

/**
 * Client boundary for Redux.
 *
 * The store is a module singleton with a fully deterministic initial state, so
 * the server render and the first client render produce identical output and
 * hydration stays clean. Everything above this component (root layout, page)
 * remains a Server Component.
 */
export function ReduxProvider({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
