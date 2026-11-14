import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, AppStore, RootState } from "@/store";

/**
 * Pre-typed Redux hooks.
 *
 * Using these instead of the raw `useSelector`/`useDispatch` means component code
 * never has to annotate `RootState` or `AppDispatch` by hand.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
