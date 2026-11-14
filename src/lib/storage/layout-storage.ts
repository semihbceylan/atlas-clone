import type { Layout, LayoutItem } from "react-grid-layout";
import { GRID_COLS, ALL_WIDGET_IDS } from "@/config/default-layout";

/**
 * localStorage persistence for the dashboard layout.
 *
 * Two rules keep this safe:
 *
 * 1. Every read is validated. A layout saved by an older build (or hand-edited
 *    in devtools) must never be able to crash the grid, so unknown widget ids,
 *    non-finite numbers and out-of-bounds items are dropped or clamped.
 * 2. localStorage is never touched during server rendering — callers only read
 *    after mount, which avoids hydration mismatches.
 */

export const LAYOUT_STORAGE_KEY = "atlas-terminal.layout.v1";

/** Minimal structural check for a persisted grid item. */
function isLayoutItem(value: unknown): value is Layout[number] {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.i === "string" &&
    Number.isFinite(item.x) &&
    Number.isFinite(item.y) &&
    Number.isFinite(item.w) &&
    Number.isFinite(item.h)
  );
}

/**
 * Normalises a persisted layout against the widgets the app currently knows about.
 *
 * @returns A usable layout, or `null` when nothing salvageable was stored.
 */
export function sanitiseLayout(value: unknown): Layout | null {
  if (!Array.isArray(value)) return null;

  const sanitised: LayoutItem[] = [];

  for (const candidate of value) {
    if (!isLayoutItem(candidate)) continue;

    const id = candidate.i;
    if (!ALL_WIDGET_IDS.includes(id as (typeof ALL_WIDGET_IDS)[number])) continue;
    if (sanitised.some((item) => item.i === id)) continue;

    const w = Math.max(1, Math.min(GRID_COLS, Math.round(candidate.w)));
    const h = Math.max(1, Math.round(candidate.h));
    const x = Math.max(0, Math.min(GRID_COLS - w, Math.round(candidate.x)));
    const y = Math.max(0, Math.round(candidate.y));

    sanitised.push({
      i: id,
      x,
      y,
      w,
      h,
      minW: Number.isFinite(candidate.minW) ? candidate.minW : undefined,
      minH: Number.isFinite(candidate.minH) ? candidate.minH : undefined,
    });
  }

  // A partial layout would leave widgets without a slot, so require all of them.
  const complete = ALL_WIDGET_IDS.every((id) => sanitised.some((item) => item.i === id));
  return complete ? sanitised : null;
}

/** Reads and validates the saved layout. Returns `null` on any problem. */
export function loadLayout(): Layout | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    return sanitiseLayout(JSON.parse(raw));
  } catch {
    // Corrupt JSON, disabled storage, quota errors — all mean "use the default".
    return null;
  }
}

/** Persists a layout. Failures are non-fatal (private mode, quota). */
export function saveLayout(layout: Layout): void {
  if (typeof window === "undefined") return;

  try {
    const serialisable = layout.map(({ i, x, y, w, h, minW, minH }) => ({
      i,
      x,
      y,
      w,
      h,
      minW,
      minH,
    }));
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(serialisable));
  } catch {
    // Ignore: persisting the layout is a convenience, never a requirement.
  }
}

/** Removes the saved layout so the next render falls back to the default. */
export function clearLayout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
