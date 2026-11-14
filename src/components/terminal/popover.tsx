"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";

/**
 * A viewport-anchored popover that renders in a portal.
 *
 * Grid widgets cannot host a dropdown themselves: every `react-grid-item` clips
 * its children (`overflow: hidden`) and the grid lives inside a scrolling
 * container, so an `absolute` menu either gets cut off or ends up below the fold.
 * Portalling to `document.body` and positioning with `position: fixed` sidesteps
 * every ancestor's clipping and stacking context, and lets the panel flip above
 * the trigger when there is not enough room below it.
 *
 * Mount this only while the popover is open (the parent owns that state), which
 * also keeps `useLayoutEffect` off the server.
 */
interface PopoverProps {
  /** Called when the user clicks outside or presses Escape. */
  onClose: () => void;
  /** The trigger element the panel is anchored to (clicks inside it are ignored). */
  anchorRef: RefObject<HTMLElement | null>;
  /** Which edge of the anchor the panel aligns to. Defaults to `"end"` (right). */
  align?: "start" | "end";
  /** Preferred side. Flips automatically when it would overflow. Defaults to `"bottom"`. */
  side?: "top" | "bottom";
  /** Gap between the anchor and the panel, in pixels. Defaults to 6. */
  offset?: number;
  /** Panel classes (colour, border, width, …). Position is applied inline. */
  className?: string;
  /** Optional ARIA role for the panel. */
  role?: string;
  /** Accessible name for the panel. */
  ariaLabel?: string;
  children: ReactNode;
}

const VIEWPORT_PADDING = 8;

export function Popover({
  onClose,
  anchorRef,
  align = "end",
  side = "bottom",
  offset = 6,
  className = "",
  role,
  ariaLabel,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // `visibility` keeps the panel invisible for the single frame before it is
  // measured, so it never flashes at the top-left of the viewport.
  const [position, setPosition] = useState<{ left: number; top: number; visible: boolean }>({
    left: 0,
    top: 0,
    visible: false,
  });

  // Position before paint so there is no flicker.
  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const a = anchor.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = viewportWidth - p.width - VIEWPORT_PADDING;
      const maxTop = viewportHeight - p.height - VIEWPORT_PADDING;

      let left = align === "end" ? a.right - p.width : a.left;
      left = Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft));

      const below = a.bottom + offset;
      const above = a.top - offset - p.height;

      let top: number;
      if (side === "bottom") {
        // Flip up only when there is genuinely more room above.
        top =
          below + p.height > viewportHeight - VIEWPORT_PADDING && above > VIEWPORT_PADDING
            ? above
            : below;
      } else {
        top = above < VIEWPORT_PADDING && below + p.height < viewportHeight - VIEWPORT_PADDING ? below : above;
      }
      top = Math.max(VIEWPORT_PADDING, Math.min(top, maxTop));

      setPosition({ left, top, visible: true });
    };

    place();

    window.addEventListener("resize", place);
    // Capture phase so scrolling inside the grid container (a descendant) still
    // repositions the panel; scroll events do not bubble but they do capture.
    window.addEventListener("scroll", place, true);

    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [align, side, offset, anchorRef]);

  // Dismiss on outside pointer-down or Escape. The anchor and the panel itself
  // both count as "inside", so clicking the trigger toggles instead of closing.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        visibility: position.visible ? "visible" : "hidden",
      }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}
