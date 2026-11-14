"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactGridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
// Structural CSS for the grid and its resize handles. Theming lives in globals.css.
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import type { ReactNode } from "react";
import {
  ALL_WIDGET_IDS,
  DEFAULT_LAYOUT,
  GRID_COLS,
  GRID_CONTAINER_PADDING,
  GRID_DRAG_CANCEL,
  GRID_DRAG_HANDLE,
  GRID_MARGIN,
  GRID_ROW_HEIGHT,
  type WidgetId,
} from "@/config/default-layout";
import { useHydrated } from "@/hooks/use-hydrated";
import { clearLayout, loadLayout, saveLayout } from "@/lib/storage/layout-storage";
import { selectLayoutResetToken } from "@/store/slices/terminal-slice";
import { useAppSelector } from "@/store/hooks";

interface DashboardGridProps {
  /** One node per widget id. Order in the DOM follows `ALL_WIDGET_IDS`. */
  widgets: Record<WidgetId, ReactNode>;
}

/** A layout plus the reset counter it was edited against. */
interface EditedLayout {
  layout: Layout;
  resetToken: number;
}

/** Cheap structural comparison so mousemove never triggers a redundant setState. */
function isSameLayout(a: Layout, b: Layout): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      item.i === other.i &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h
    );
  });
}

/** Keeps only the fields we persist, and nothing RGL sets internally. */
function toPersistedLayout(layout: Layout): Layout {
  return layout.map(({ i, x, y, w, h, minW, minH }): LayoutItem => ({ i, x, y, w, h, minW, minH }));
}

/**
 * The draggable/resizable widget grid.
 *
 * Three details matter here:
 *
 * 1. **Hydration** — the restored layout is only read once `useHydrated()` flips
 *    to `true`, so the server and the first client render both use the default
 *    arrangement and hydration cannot mismatch.
 * 2. **Persistence** — layout changes are held in React state during a drag
 *    (cheap) but only written to localStorage on `onDragStop`/`onResizeStop`, so a
 *    drag gesture produces exactly one storage write instead of one per frame.
 * 3. **Interaction isolation** — `dragConfig.handle` scopes dragging to widget
 *    headers, so the chart's crosshair and zoom gestures never move the panel.
 */
export function DashboardGrid({ widgets }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1600 });
  const hydrated = useHydrated();
  const [containerHeight, setContainerHeight] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setContainerHeight(entry.contentRect.height));
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);
  const layoutResetToken = useAppSelector(selectLayoutResetToken);

  // Read localStorage exactly once, after hydration. `loadLayout` validates the
  // payload and returns `null` for anything unusable (old schema, corrupt JSON).
  const restoredLayout = useMemo(() => (hydrated ? loadLayout() : null), [hydrated]);

  const [edited, setEdited] = useState<EditedLayout | null>(null);

  // A newer reset counter than the one the current edit was made against means
  // the user asked for the default arrangement. Deriving the rendered layout
  // (instead of resetting it from an effect) keeps this a pure render.
  const resetPending =
    layoutResetToken > 0 && (edited === null || edited.resetToken < layoutResetToken);

  const layout = resetPending ? DEFAULT_LAYOUT : (edited?.layout ?? restoredLayout ?? DEFAULT_LAYOUT);

  // Clearing storage is a side effect on an external system, so it belongs in an
  // effect — the layout above is already derived without it.
  useEffect(() => {
    if (layoutResetToken > 0) clearLayout();
  }, [layoutResetToken]);

  const handleLayoutChange = useCallback(
    (next: Layout) => {
      const persisted = toPersistedLayout(next);

      setEdited((current) => {
        // Returning the same object lets React bail out of the re-render, which
        // matters because RGL fires this on every drag frame.
        if (current && isSameLayout(current.layout, persisted)) return current;
        return { layout: persisted, resetToken: layoutResetToken };
      });
    },
    [layoutResetToken],
  );

  const persistLayout = useCallback(
    (next: Layout) => {
      const persisted = toPersistedLayout(next);
      saveLayout(persisted);
      setEdited({ layout: persisted, resetToken: layoutResetToken });
    },
    [layoutResetToken],
  );

  const narrow = width < 700;
  const renderedLayout = narrow ? layout.map((item, index) => ({ ...item, x: 0, y: index === 0 ? 0 : 12 + (index - 1) * 6, w: GRID_COLS, h: index === 0 ? 12 : 6, minW: GRID_COLS })) : layout;

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"

    >
      {/*
        Rendered as soon as the container is measurable. The server and the first
        client render both use `initialWidth` and the default layout, so the
        markup matches; the saved layout is applied right after hydration.
      */}
      {mounted ? (
        <ReactGridLayout
          width={width}
          layout={renderedLayout}
          gridConfig={{
            cols: GRID_COLS,
            rowHeight: containerHeight ? Math.max(26, (containerHeight - 24) / 12) : GRID_ROW_HEIGHT,
            margin: GRID_MARGIN,
            containerPadding: GRID_CONTAINER_PADDING,
          }}
          dragConfig={{
            enabled: !narrow,
            handle: GRID_DRAG_HANDLE,
            cancel: GRID_DRAG_CANCEL,
          }}
          resizeConfig={{
            enabled: !narrow,
            handles: ["se", "s", "e"],
          }}
          compactor={verticalCompactor}
          onLayoutChange={narrow ? undefined : handleLayoutChange}
          onDragStop={persistLayout}
          onResizeStop={persistLayout}
        >
          {ALL_WIDGET_IDS.map((id) => (
            <div key={id} className="min-h-0 overflow-hidden">
              {widgets[id]}
            </div>
          ))}
        </ReactGridLayout>
      ) : null}
    </div>
  );
}
