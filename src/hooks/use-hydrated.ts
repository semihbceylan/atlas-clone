"use client";

import { useSyncExternalStore } from "react";

/** No-op subscribe: hydration is a one-way transition, there are no updates. */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Returns `false` during the server render and the first client render, and
 * `true` afterwards.
 *
 * This is the hydration-safe way to decide "is it safe to read browser-only state
 * yet?". `useSyncExternalStore` is used instead of `useState` + `useEffect`
 * because the transition is a snapshot change in an external system, not a state
 * update — and because setting state synchronously inside an effect is
 * discouraged (it causes a cascading render).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
