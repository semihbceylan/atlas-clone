"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popover when the user clicks away from it or presses Escape.
 *
 * Shared by the header menus and the watchlist's symbol picker so both dismiss
 * consistently. The listener is only attached while the popover is open.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const node = ref.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      onOutside();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOutside();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onOutside, ref]);
}
