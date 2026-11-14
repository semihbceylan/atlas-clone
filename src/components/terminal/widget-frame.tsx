import type { ReactNode } from "react";

/**
 * Shared chrome for every dashboard widget.
 *
 * The header doubles as the only drag handle for `react-grid-layout` (see
 * `GRID_DRAG_HANDLE`), so the chart's canvas — which needs free mouse
 * interaction for crosshair panning and zooming — can never start a widget drag.
 * Interactive header controls opt out via `widget-no-drag`.
 */
interface WidgetFrameProps {
  /** String titles get the standard uppercase treatment; nodes render as-is. */
  title: ReactNode;
  /** Accessible region name. Defaults to `title` when it is a string. */
  ariaLabel?: string;
  /** Right-aligned header controls. Automatically excluded from the drag handle. */
  actions?: ReactNode;
  children: ReactNode;
  /** Extra classes for the outer panel. */
  className?: string;
  /** Extra classes for the body (the part below the header). */
  bodyClassName?: string;
}

export function WidgetFrame({
  title,
  ariaLabel,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: WidgetFrameProps) {
  return (
    <section
      tabIndex={-1}
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      className={`widget-frame flex h-full min-h-0 flex-col overflow-hidden rounded-[2px] border border-terminal-border bg-terminal-panel ${className}`}
    >
      <header className="widget-drag-handle flex h-10 shrink-0 cursor-grab items-center gap-2.5 border-b border-terminal-border px-3 select-none active:cursor-grabbing">
        {typeof title === "string" ? <span aria-hidden className="size-2 shrink-0 rounded-full border border-terminal-muted" /> : null}
        {typeof title === "string" ? (
          <h2 className="truncate text-[13px] font-medium text-terminal-text">
            {title}
          </h2>
        ) : (
          title
        )}

        {actions ? (
          <div className="widget-no-drag ml-auto flex items-center gap-0.5">{actions}</div>
        ) : null}
      </header>

      <div className={`relative min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
