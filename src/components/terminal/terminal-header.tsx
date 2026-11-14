"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Bell, ChevronDown, Search, Plus, Maximize, User, RotateCcw, ChartNoAxesCombined, LayoutGrid } from "lucide-react";
import { SYMBOLS } from "@/config/market-symbols";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { requestLayoutReset, selectWatchlist, setSelectedSymbol } from "@/store/slices/terminal-slice";

const MENU_PANEL = "absolute top-full right-2 z-40 overflow-hidden rounded-md border border-terminal-border-strong bg-terminal-elevated shadow-2xl";
type Menu = "search" | "layout" | "modules" | "account" | "notifications" | null;

export function TerminalHeader() {
  const dispatch = useAppDispatch();
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpenMenu(null), []);
  useClickOutside(headerRef, openMenu !== null, close);
  useEffect(() => {
    const openSearch = () => setOpenMenu("search");
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault(); setOpenMenu(current => current === "search" ? null : "search");
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("atlas:search", openSearch);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("atlas:search", openSearch); };
  }, []);
  const toggle = (menu: Menu) => setOpenMenu(current => current === menu ? null : menu);
  const fullscreen = () => {
    const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void action.catch(() => {});
  };
  return (
    <header ref={headerRef} className="workspace-nav relative z-30 flex h-9 shrink-0 items-stretch justify-between border-b border-terminal-border bg-[#1c1d27]/80 text-[13px]">
      <div className="flex min-w-0 items-stretch">
        <div aria-label="Terminal Lab — independent portfolio project" className="flex w-12 shrink-0 items-center justify-center sm:w-20" title="Terminal Lab · Portfolio demo">
          <span className="rounded border border-terminal-accent/40 px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-tight text-terminal-accent-soft">TL</span>
        </div>
        <button type="button" onClick={() => toggle("layout")} aria-expanded={openMenu === "layout"} className="flex w-28 items-center sm:w-36 gap-2 border-x border-terminal-border bg-white/5 px-2.5 hover:bg-terminal-hover">
          <span className="flex size-5 items-center justify-center rounded-full bg-black text-[11px]">1</span><span className="truncate">İlk görünüm</span><ChevronDown className="ml-auto size-3 text-terminal-muted"/>
        </button>
      </div>
      <div className="flex items-stretch divide-x divide-terminal-border border-l border-terminal-border">
        <button type="button" title="Arama (⌘K)" aria-label="Arama" onClick={() => toggle("search")} className="px-3 hover:bg-terminal-hover"><Search className="size-4"/></button>
        <button type="button" onClick={() => toggle("modules")} aria-expanded={openMenu === "modules"} className="flex items-center gap-2 px-3 hover:bg-terminal-hover"><Plus className="size-4"/><span className="hidden sm:inline">Modül ekle</span></button>
        <span title="Emirler simülasyondur" className="hidden items-center gap-2 bg-terminal-up/5 px-3 text-terminal-up lg:flex"><ChartNoAxesCombined className="size-4"/><span className="text-[11px]">Demo portföy</span></span>
        <button type="button" aria-label="Bildirimler" onClick={() => toggle("notifications")} className="px-2.5 hover:bg-terminal-hover"><Bell className="size-4"/></button>
        <button type="button" aria-label="Kullanıcı menüsü" onClick={() => toggle("account")} className="px-2.5 hover:bg-terminal-hover"><User className="size-4"/></button>
        <button type="button" aria-label="Tam ekran" onClick={fullscreen} className="px-2.5 hover:bg-terminal-hover"><Maximize className="size-4"/></button>
      </div>
      {openMenu === "search" ? <SearchPalette onSelect={symbol => { dispatch(setSelectedSymbol(symbol)); close(); }}/> : null}
      {openMenu === "layout" ? <div className={`${MENU_PANEL} left-20 right-auto w-60 p-2`}>
        <p className="px-2 py-2 text-terminal-muted">Çalışma alanı</p>
        <button type="button" onClick={() => { dispatch(requestLayoutReset()); close(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-terminal-hover"><RotateCcw className="size-4"/>Varsayılan düzeni yükle</button>
        <p className="px-2 py-2 text-[11px] leading-relaxed text-terminal-muted">Panelleri başlıklarından taşıyabilir, kenarlarından boyutlandırabilirsin.</p>
      </div> : null}
      {openMenu === "modules" ? <div className={`${MENU_PANEL} w-64 p-3`}>
        <p className="mb-3 font-medium">Çalışma alanındaki modüller</p>
        {["Fiyat grafiği", "Pozisyonlar", "Takip Ettiklerim"].map(label => <button key={label} type="button" onClick={() => { document.querySelector<HTMLElement>(`section[aria-label="${label}"]`)?.focus(); close(); }} className="flex w-full items-center gap-2 border-t border-terminal-border py-3 text-left hover:text-terminal-accent-soft"><LayoutGrid className="size-4"/>{label}<span className="ml-auto text-[10px] text-terminal-muted">Eklendi</span></button>)}
      </div> : null}
      {openMenu === "account" || openMenu === "notifications" ? <div className={`${MENU_PANEL} w-64 p-4`}><p className="mb-2 font-medium">{openMenu === "account" ? "Terminal Lab · Demo çalışma alanı" : "Bildirimler"}</p><p className="text-[12px] leading-relaxed text-terminal-muted">{openMenu === "account" ? "Bağımsız portföy projesi. Midas ile bağlantılı değildir. Tüm emirler simülasyondur. Canlı fiyatlar yalnızca yerel değerlendirme için ayrıca etkinleştirilebilir." : "Henüz bir bildirimin bulunmuyor."}</p></div> : null}
    </header>
  );
}

interface SearchPaletteProps {
  onSelect: (symbol: string) => void;
}

/** A single row in the palette. */
interface PaletteEntry {
  symbol: string;
  name: string;
}

/**
 * Command-palette style symbol switcher.
 *
 * Owns its query and highlight state so that closing the palette resets them for
 * free (it unmounts), and so the highlight can be *derived* from the query rather
 * than reset from an effect.
 *
 * Keyboard driven: ↑/↓ move the highlight, Enter selects, Escape (handled by
 * `useClickOutside`) dismisses.
 */
function SearchPalette({ onSelect }: SearchPaletteProps) {
  const watchlist = useAppSelector(selectWatchlist);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<{ index: number; query: string }>({
    index: 0,
    query: "",
  });

  const results = useMemo<PaletteEntry[]>(() => {
    // Watched symbols rank first so the most relevant hits come up top.
    const catalogue: PaletteEntry[] = [
      ...watchlist.map((item) => ({ symbol: item.symbol, name: item.name })),
      ...Object.values(SYMBOLS).map((item) => ({ symbol: item.symbol, name: item.name })),
    ];

    const deduped = Array.from(
      new Map(catalogue.map((item) => [item.symbol, item] as const)).values(),
    );

    const term = query.trim().toLocaleLowerCase("tr");
    if (!term) return deduped;

    return deduped.filter(
      (item) =>
        item.symbol.toLocaleLowerCase("tr").includes(term) ||
        item.name.toLocaleLowerCase("tr").includes(term),
    );
  }, [query, watchlist]);

  // Derived, not stored: a new query starts the highlight over at the top.
  const highlight =
    highlighted.query === query
      ? Math.min(highlighted.index, Math.max(results.length - 1, 0))
      : 0;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted({ index: Math.min(highlight + 1, results.length - 1), query });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted({ index: Math.max(highlight - 1, 0), query });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[highlight];
      if (selected) onSelect(selected.symbol);
    }
  };

  return (
    <div role="dialog" aria-label="Sembol ara" className={`${MENU_PANEL} w-[360px]`}>
      <div className="flex items-center gap-2 border-b border-terminal-border px-2.5 py-2">
        <Search className="size-3.5 text-terminal-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Sembol veya şirket ara…"
          aria-label="Sembol ara"
          className="w-full bg-transparent text-[12px] text-terminal-text placeholder:text-terminal-subtle focus:outline-none"
        />
      </div>

      <ul className="max-h-72 overflow-y-auto py-1">
        {results.length === 0 ? (
          <li className="px-3 py-2 text-[11px] text-terminal-muted">Sonuç bulunamadı.</li>
        ) : (
          results.map((item, index) => (
            <li key={item.symbol}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted({ index, query })}
                onClick={() => onSelect(item.symbol)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                  index === highlight ? "bg-terminal-hover" : ""
                }`}
              >
                <span className="text-[11.5px] font-semibold text-terminal-text">
                  {item.symbol}
                </span>
                <span className="truncate text-[10.5px] text-terminal-muted">{item.name}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
