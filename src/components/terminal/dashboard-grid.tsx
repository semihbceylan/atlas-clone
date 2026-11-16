"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, {
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { noOverlapCompactor, transformStrategy } from "react-grid-layout/core";
// Structural CSS for the grid and its resize handles. Theming lives in globals.css.
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import type { ReactNode } from "react";
import {
  DEFAULT_LAYOUT,
  ALL_WIDGET_IDS,
  GRID_COLS,
  GRID_ROWS,
  WIDGET_MIN_SIZE,
  GRID_CONTAINER_PADDING,
  GRID_DRAG_CANCEL,
  GRID_DRAG_HANDLE,
  GRID_MARGIN,
  type WidgetId,
} from "@/config/default-layout";
import { useHydrated } from "@/hooks/use-hydrated";
import { clearLayout, loadLayout, saveLayout } from "@/lib/storage/layout-storage";
import { selectLayoutResetToken, toggleModule } from "@/store/slices/terminal-slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { WidgetContext, type WidgetCommand } from "@/components/terminal/widget-context";
import { WorkspaceStarter } from "./workspace-views";

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
  const dispatch = useAppDispatch();
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1600 });
  const hydrated = useHydrated();
  const [containerHeight, setContainerHeight] = useState(0);
  const resizing = useRef(false);
  const dragging = useRef(false);
  const rowHeight = Math.max(1, (containerHeight - GRID_CONTAINER_PADDING[1] * 2 - GRID_MARGIN[1] * (GRID_ROWS - 1)) / GRID_ROWS);
  const positionStrategy = {
    ...transformStrategy,
    calcStyle(position: Parameters<typeof transformStrategy.calcStyle>[0]) {
      if (!resizing.current && !dragging.current) return transformStrategy.calcStyle(position);
      const stepX = (width - GRID_CONTAINER_PADDING[0] * 2 + GRID_MARGIN[0]) / GRID_COLS;
      const stepY = rowHeight + GRID_MARGIN[1];
      const x = Math.round((position.left - GRID_CONTAINER_PADDING[0]) / stepX);
      const y = Math.round((position.top - GRID_CONTAINER_PADDING[1]) / stepY);
      const w = Math.round((position.width + GRID_MARGIN[0]) / stepX);
      const h = Math.round((position.height + GRID_MARGIN[1]) / stepY);
      const left = Math.round(x * stepX + GRID_CONTAINER_PADDING[0]);
      const top = Math.round(y * stepY + GRID_CONTAINER_PADDING[1]);
      return transformStrategy.calcStyle({
        left, top,
        width: Math.round((x + w) * stepX + GRID_CONTAINER_PADDING[0]) - left - GRID_MARGIN[0],
        height: Math.round((y + h) * stepY + GRID_CONTAINER_PADDING[1]) - top - GRID_MARGIN[1],
      });
    },
  };
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setContainerHeight(entry.contentRect.height));
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);
  const layoutResetToken = useAppSelector(selectLayoutResetToken);
  const visibleModules = useAppSelector(state => state.terminal.visibleModules);

  // Read localStorage exactly once, after hydration. `loadLayout` validates the
  // payload and returns `null` for anything unusable (old schema, corrupt JSON).
  const restoredLayout = useMemo(() => (hydrated ? loadLayout() : null), [hydrated]);

  const [edited, setEdited] = useState<EditedLayout | null>(null);
  const restoredCopies = useMemo<string[]>(() => {
    if (!hydrated) return [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem("terminal-lab.copies.v1") ?? "[]");
      return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.includes(":") && ALL_WIDGET_IDS.includes(id.split(":")[0] as WidgetId)))].slice(0, 30) : [];
    } catch { return []; }
  }, [hydrated]);
  const [copies, setCopies] = useState<string[] | null>(null);
  const instances = [...visibleModules, ...(copies ?? restoredCopies)];
  const [stack, setStack] = useState<string[]>([]);
  if (instances.some(id => !stack.includes(id)) || stack.some(id => !instances.includes(id))) {
    setStack([...stack.filter(id => instances.includes(id)), ...instances.filter(id => !stack.includes(id))]);
  }
  const raise = (id: string) => setStack(current => current[current.length - 1] === id ? current : [...current.filter(value => value !== id), id]);
  const updateCopies = (next: string[]) => {
    setCopies(next);
    try { localStorage.setItem("terminal-lab.copies.v1", JSON.stringify(next)); } catch { /* Optional storage. */ }
  };

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

  const activeLayout = instances.map((id, index) => layout.find(item => item.i === id) ?? {
    i: id, x: 8 + (index % 5) * 3, y: 2 + (index % 5) * 2,
    w: 24, h: 14, minW: 10, minH: 6,
  });
  const renderedLayout = activeLayout.map(item => {
    const minimum = WIDGET_MIN_SIZE[item.i.split(":")[0] as WidgetId];
    const w = Math.max(minimum.minW, Math.min(GRID_COLS, item.w));
    const h = Math.max(minimum.minH, Math.min(GRID_ROWS, item.h));
    return { ...item, ...minimum, w, h, x: Math.min(item.x, GRID_COLS - w), y: Math.min(item.y, GRID_ROWS - h) };
  });
  // New modules start on top; interaction then determines the frontmost window.
  const stackingOrder = [...instances.filter(id => !stack.includes(id)), ...stack.filter(id => instances.includes(id))];
  const command = (id: string, action: WidgetCommand) => {
    const type = id.split(":")[0] as WidgetId;
    if (action === "remove") {
      if (id.includes(":")) updateCopies(instances.filter(value => value.includes(":") && value !== id));
      else dispatch(toggleModule(type));
      return;
    }
    const item = renderedLayout.find(row => row.i === id);
    if (!item) return;
    if (action === "duplicate") {
      if (instances.length >= 30) return;
      const nextId = `${type}:${crypto.randomUUID()}`;
      updateCopies([...instances.filter(value => value.includes(":")), nextId]);
      persistLayout([...renderedLayout, { ...item, i: nextId, x: Math.min(GRID_COLS - item.w, item.x + 2), y: Math.min(GRID_ROWS - item.h, item.y + 1) }]);
      raise(nextId);
      return;
    }
    const defaults = DEFAULT_LAYOUT.find(row => row.i === type) ?? { w: 24, h: 14 };
    const size = action === "expand" ? { x: 0, y: 0, w: GRID_COLS, h: GRID_ROWS } : { w: defaults.w, h: defaults.h, x: Math.min(item.x, GRID_COLS - defaults.w), y: Math.min(item.y, GRID_ROWS - defaults.h) };
    persistLayout(renderedLayout.map(row => row.i === id ? { ...row, ...size } : row));
    raise(id);
  };

  return (
    <div
      ref={containerRef}
      data-testid="workspace"
      className="workspace-surface relative isolate min-h-0 flex-1 overflow-hidden"

    >
      {/*
        Rendered as soon as the container is measurable. The server and the first
        client render both use `initialWidth` and the default layout, so the
        markup matches; the saved layout is applied right after hydration.
      */}
      {mounted && hydrated && instances.length > 0 ? (
        <ReactGridLayout
          width={width}
          autoSize={false}
          style={{ height: "100%" }}
          layout={renderedLayout}
          gridConfig={{
            cols: GRID_COLS,
            maxRows: GRID_ROWS,
            rowHeight,
            margin: GRID_MARGIN,
            containerPadding: GRID_CONTAINER_PADDING,
          }}
          dragConfig={{
            enabled: true,
            bounded: true,
            handle: GRID_DRAG_HANDLE,
            cancel: GRID_DRAG_CANCEL,
          }}
          resizeConfig={{
            enabled: true,
            handles: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
          }}
          compactor={noOverlapCompactor}
          positionStrategy={positionStrategy}
          onResizeStart={() => { resizing.current = true; }}
          onDragStart={() => { dragging.current = true; }}
          onLayoutChange={handleLayoutChange}
          onDragStop={next => { dragging.current = false; persistLayout(next); }}
          onResizeStop={next => { resizing.current = false; persistLayout(next); }}
        >
          {instances.map((id) => (
            <div key={id} data-widget-id={id} onPointerDownCapture={() => raise(id)} onFocusCapture={() => raise(id)} style={{ zIndex: stackingOrder.indexOf(id) + 1 }} className="min-h-0 overflow-hidden">
              <WidgetContext.Provider value={{ id, type: id.split(":")[0] as WidgetId, command: action => command(id, action) }}>{widgets[id.split(":")[0] as WidgetId]}</WidgetContext.Provider>
            </div>
          ))}
        </ReactGridLayout>
      ) : null}
      {mounted && hydrated && instances.length === 0 ? <WorkspaceStarter/> : null}
    </div>
  );
}
