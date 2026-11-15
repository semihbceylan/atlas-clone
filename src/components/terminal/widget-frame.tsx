"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical, Copy, Expand, RectangleHorizontal, Trash2, ExternalLink, Search, Settings2, ChartCandlestick, List, BriefcaseBusiness, ScanSearch, History, Info, ChartPie, Newspaper } from "lucide-react";
import { useWidgetContext } from "./widget-context";
import { Popover } from "./popover";
import { IconButton } from "./icon-button";
import { WIDGET_LABELS } from "@/config/default-layout";

const MODULE_ICONS = { chart: ChartCandlestick, watchlist: List, positions: BriefcaseBusiness, screener: ScanSearch, portfolio: ChartPie, orders: History, details: Info, news: Newspaper };

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
  const widget = useWidgetContext();
  const [menu, setMenu] = useState<"options" | "view" | null>(null);
  const [compact, setCompact] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const [linkColor, setLinkColor] = useState("#737582");
  const [colorOpen, setColorOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const colorAnchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-widget-menu="${widget?.id ?? "module"}"] [role^="menuitem"]`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [menu, widget?.id]);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.querySelectorAll<HTMLElement>("[data-search-symbol]").forEach(row => {
      row.hidden = searchOpen && !row.dataset.searchSymbol?.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"));
    });
  }, [query, searchOpen, children]);
  const label = widget ? WIDGET_LABELS[widget.type] : ariaLabel ?? (typeof title === "string" ? title : "Modül");
  const Icon = widget ? MODULE_ICONS[widget.type] : List;
  const exportPanel = () => {
    const content = section.current?.querySelector("[data-widget-body]")?.textContent ?? "";
    const url = URL.createObjectURL(new Blob([`${label}\nDemo / simüle veri\n${content}`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${widget?.type ?? "module"}-demo.txt`; link.click(); URL.revokeObjectURL(url); setMenu(null);
  };
  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      data-compact={compact}
      data-show-names={showNames}
      className={`widget-frame flex h-full min-h-0 flex-col overflow-hidden rounded-[2px] border border-terminal-border bg-terminal-panel ${className}`}
    >
      <header className="widget-drag-handle flex h-10 shrink-0 cursor-grab items-center gap-2.5 border-b border-terminal-border px-3 select-none active:cursor-grabbing">
        <div ref={colorAnchor} className="widget-no-drag shrink-0">
          <button type="button" aria-label={`${label} bağlantı rengi`} title="Modül rengi (yerel görsel etiket)" aria-expanded={colorOpen} onClick={() => setColorOpen(!colorOpen)} className="flex size-6 items-center justify-center rounded hover:bg-terminal-hover"><span className="size-2 rounded-full border" style={{ borderColor: linkColor, background: linkColor === "#737582" ? "transparent" : linkColor }}/></button>
          {colorOpen ? <Popover anchorRef={colorAnchor} onClose={() => setColorOpen(false)} role="dialog" ariaLabel="Modül rengi" className="z-[100] rounded border border-terminal-border bg-terminal-elevated p-3 shadow-xl"><p className="mb-2 text-[11px] text-terminal-muted">Görsel etiket · Sembol bağlantısını değiştirmez</p><div className="flex gap-2">{["#737582", "#7165ff", "#16c784", "#ef4453", "#f5bd4f", "#48a9f8"].map(color => <button key={color} aria-label={`Renk ${color}`} onClick={() => { setLinkColor(color); setColorOpen(false); }} className="size-5 rounded-full border border-white/20" style={{ background: color }}/>)}</div></Popover> : null}
        </div>
        {typeof title === "string" ? (
          <><Icon aria-hidden className="size-3.5 shrink-0 text-terminal-muted"/><h2 className="truncate text-[13px] font-medium text-terminal-text">{title}</h2></>
        ) : (
          title
        )}

        <div ref={anchor} className="widget-no-drag ml-auto flex shrink-0 items-center gap-0.5">
          {actions}
          {widget && ["positions", "orders", "watchlist"].includes(widget.type) ? <IconButton label={`${label} ara`} icon={<Search className="size-3.5"/>} size="sm" active={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setQuery(""); }}/> : null}
          {widget?.type !== "chart" ? <IconButton label={`${label} görünüm`} icon={<Settings2 className="size-3.5"/>} size="sm" aria-haspopup="menu" aria-expanded={menu === "view"} onClick={() => setMenu(menu === "view" ? null : "view")}/> : null}
          <IconButton label={`${label} seçenekleri`} icon={<EllipsisVertical className="size-4"/>} size="sm" aria-haspopup="menu" aria-expanded={menu === "options"} onClick={() => setMenu(menu === "options" ? null : "options")}/>
          {menu ? <Popover anchorRef={anchor} onClose={() => setMenu(null)} role="menu" ariaLabel={`${label} ${menu === "view" ? "görünüm" : "seçenekleri"}`} className="z-[100] w-52 rounded-md border border-terminal-border-strong bg-terminal-elevated p-1 text-xs shadow-2xl">
            <div data-widget-menu={widget?.id ?? "module"} onKeyDown={event => {
              const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]')];
              const index = items.indexOf(document.activeElement as HTMLButtonElement);
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
              }
            }}>
            {menu === "options" ? <>
              <button role="menuitem" onClick={exportPanel} className="widget-menu-item"><ExternalLink className="size-4"/>Dışarıya al<span className="ml-auto text-[9px] text-terminal-muted">TXT</span></button>
              <button role="menuitem" onClick={() => { widget?.command("default-size"); setMenu(null); }} className="widget-menu-item"><RectangleHorizontal className="size-4"/>Varsayılan boyut</button>
              <button role="menuitem" onClick={() => { widget?.command("expand"); setMenu(null); }} className="widget-menu-item"><Expand className="size-4"/>Tüm alana yay</button>
              <button role="menuitem" onClick={() => { widget?.command("duplicate"); setMenu(null); }} className="widget-menu-item"><Copy className="size-4"/>Çoğalt</button>
              <div className="my-1 border-t border-terminal-border"/>
              <button role="menuitem" onClick={() => { setMenu(null); widget?.command("remove"); }} className="widget-menu-item text-terminal-down"><Trash2 className="size-4"/>Modülü kaldır</button>
            </> : <>
              <button role="menuitemcheckbox" aria-checked={compact} onClick={() => setCompact(!compact)} className="widget-menu-item">{compact ? "✓" : "○"} Kompakt görünüm</button>
              {widget && ["watchlist", "screener", "details"].includes(widget.type) ? <button role="menuitemcheckbox" aria-checked={showNames} onClick={() => setShowNames(!showNames)} className="widget-menu-item">{showNames ? "✓" : "○"} Şirket adlarını göster</button> : null}
            </>}
            </div>
          </Popover> : null}
        </div>
      </header>
      {searchOpen ? <input autoFocus aria-label={`${label} içinde ara`} placeholder="Sembol ara…" value={query} onChange={event => setQuery(event.target.value)} className="widget-no-drag shrink-0 border-b border-terminal-border bg-terminal-bg px-3 py-2 text-xs outline-none"/> : null}
      <div data-widget-body className={`relative min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
