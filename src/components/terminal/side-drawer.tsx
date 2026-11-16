"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function changeDrawer(next?: () => void) {
  if (document.querySelector('.terminal-drawer')) {
    window.dispatchEvent(new Event("terminal:close-drawer"));
  }
  next?.();
}

export function SideDrawer({ title, onClose, children, footer, back, closeLabel = "Paneli kapat", compact = false }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; back?: ReactNode; closeLabel?: string; compact?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const close = useCallback(() => setClosing(true), []);
  useEffect(() => {
    const request = () => close();
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || panel.current?.contains(target) || target.closest('[data-drawer-trigger]')) return;
      close();
    };
    window.addEventListener("terminal:close-drawer", request);
    document.addEventListener("pointerdown", outside, true);
    return () => { window.removeEventListener("terminal:close-drawer", request); document.removeEventListener("pointerdown", outside, true); };
  }, [close]);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => { onCloseRef.current(); }, 160);
    return () => window.clearTimeout(timer);
  }, [closing]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.key !== "Tab") return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)') ?? [])];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("keydown", key, true); if (!document.querySelector('.terminal-drawer[data-state="open"]')) previous?.focus(); };
  }, [close]);
  return createPortal(<div data-state={closing ? "closed" : "open"} className="terminal-drawer-overlay fixed inset-x-0 bottom-0 top-10 z-[120] bg-black/30" onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} data-state={closing ? "closed" : "open"} className="terminal-drawer absolute bottom-4 right-4 top-3.5 flex w-[368px] max-w-[calc(100%-32px)] flex-col overflow-hidden rounded-md border border-terminal-border bg-terminal-panel/90 text-terminal-text shadow-xl backdrop-blur-md outline-none">
      <header className={compact ? "flex h-12 shrink-0 items-center gap-2 px-2.5" : "flex h-14 shrink-0 items-center gap-2 border-b border-terminal-border px-5"}>{back}<h2 className="flex-1 text-[13px] font-semibold">{title}</h2><button type="button" aria-label={closeLabel} onClick={close} className="rounded p-1.5 text-terminal-muted hover:bg-terminal-hover"><X aria-hidden className="size-4"/></button></header>
      <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? "px-2.5 pb-2.5" : "p-4"}`}>{children}</div>
      {footer ? <footer className="shrink-0 border-t border-terminal-border p-4">{footer}</footer> : null}
    </aside>
  </div>, document.body);
}
