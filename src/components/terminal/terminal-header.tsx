"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlarmClock, Bell, Search, Plus, Maximize, User, RotateCcw, ChartNoAxesCombined, LifeBuoy, ExternalLink } from "lucide-react";
import { SYMBOLS } from "@/config/market-symbols";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { requestLayoutReset, selectWatchlist, setSelectedSymbol } from "@/store/slices/terminal-slice";
import { ModuleCatalog } from "./module-catalog";
import { WorkspaceViews, WorkspaceViewTabs, createWorkspaceView } from "./workspace-views";
import { UserMenu } from "./user-menu";
import { SideDrawer, changeDrawer } from "./side-drawer";

const MENU_PANEL = "absolute top-full right-2 z-40 overflow-hidden rounded-md border border-terminal-border-strong bg-terminal-elevated shadow-2xl";
type Menu = "search" | "layout" | "modules" | "account" | "notifications" | "support" | null;

export function TerminalHeader({ onAlerts }: { onAlerts: () => void }) {
  const dispatch = useAppDispatch();
  const [openMenu, setOpenMenu] = useState<Menu>(null);
  const [exitingMenus, setExitingMenus] = useState<Menu[]>([]);
  const closeDrawer = (menu: Menu) => {
    setExitingMenus(current => current.filter(item => item !== menu));
    setOpenMenu(current => current === menu ? null : current);
  };
  const headerRef = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpenMenu(null), []);
  useClickOutside(headerRef, openMenu !== null && !["account", "modules", "notifications"].includes(openMenu), close);
  useEffect(() => {
    const openSearch = () => setOpenMenu("search");
    const openModules = () => setOpenMenu("modules");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault(); setOpenMenu(current => current === "search" ? null : "search");
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("atlas:search", openSearch);
    window.addEventListener("atlas:modules", openModules);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("atlas:search", openSearch); window.removeEventListener("atlas:modules", openModules); };
  }, [close]);
  const toggle = (menu: Menu) => {
    if (["modules", "notifications", "account"].includes(menu ?? "")) {
      changeDrawer(openMenu === menu ? undefined : () => {
        if (openMenu && ["modules", "notifications", "account"].includes(openMenu)) setExitingMenus(current => [...current, openMenu]);
        setOpenMenu(menu);
      });
      return;
    }
    setOpenMenu(current => current === menu ? null : menu);
  };
  const fullscreen = () => {
    const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void action.catch(() => {});
  };
  return (
    <header ref={headerRef} className="workspace-nav relative z-30 flex h-9 shrink-0 items-stretch justify-between border-b border-terminal-border bg-terminal-nav text-[13px]">
      <div className="flex min-w-0 items-stretch">
        <div aria-label="Terminal Lab — independent portfolio project" className="flex w-12 shrink-0 items-center justify-center sm:w-20" title="Terminal Lab · Portfolio demo">
          <span className="rounded border border-terminal-accent/40 px-1.5 py-0.5 font-mono text-[12px] font-semibold tracking-tight text-terminal-accent-soft">TL</span>
        </div>
        <WorkspaceViewTabs onMenu={() => toggle("layout")} expanded={openMenu === "layout"}/>
        <button type="button" aria-label="Yeni görünüm oluştur" title="Yeni görünüm" onClick={() => { try { createWorkspaceView(); } catch (error) { window.alert(error instanceof Error ? error.message : "Görünüm oluşturulamadı."); } }} className="flex aspect-square h-full shrink-0 items-center justify-center border-r border-terminal-border hover:bg-terminal-hover"><Plus aria-hidden className="size-4"/></button>
      </div>
      <div className="flex items-stretch divide-x divide-terminal-border border-l border-terminal-border">
        <button type="button" title="Arama (⌘K)" aria-label="Arama" onClick={() => toggle("search")} className="px-3 hover:bg-terminal-hover"><Search className="size-4"/></button>
        <button type="button" data-drawer-trigger onClick={() => toggle("modules")} aria-expanded={openMenu === "modules"} className="flex items-center gap-2 px-3 font-medium hover:bg-terminal-hover"><Plus className="size-4"/><span className="hidden sm:inline">Modül ekle</span></button>
        <span title="Emirler simülasyondur" className="hidden items-center gap-2 bg-terminal-up/5 px-3 text-terminal-up lg:flex"><ChartNoAxesCombined className="size-4"/><span className="text-[11px]">Demo portföy</span></span>
        <button type="button" data-drawer-trigger aria-label="Alarmlar" title="Alarmlar" onClick={onAlerts} className="flex items-center justify-center px-2.5 hover:bg-terminal-hover"><AlarmClock aria-hidden className="size-4"/></button>
        <button type="button" aria-label="Terminal Lab Destek" title="Terminal Lab Destek" aria-haspopup="dialog" aria-expanded={openMenu === "support"} onClick={() => toggle("support")} className="flex items-center justify-center px-2.5 hover:bg-terminal-hover"><LifeBuoy aria-hidden className="size-4"/></button>
        <button type="button" data-drawer-trigger aria-label="Bildirimler" onClick={() => toggle("notifications")} className="px-2.5 hover:bg-terminal-hover"><Bell className="size-4"/></button>
        <button type="button" data-drawer-trigger aria-label="Kullanıcı menüsü" aria-haspopup="dialog" aria-expanded={openMenu === "account"} onClick={() => toggle("account")} className="px-2.5 hover:bg-terminal-hover"><User className="size-4"/></button>
        <button type="button" aria-label="Tam ekran" onClick={fullscreen} className="px-2.5 hover:bg-terminal-hover"><Maximize className="size-4"/></button>
      </div>
      {openMenu === "search" ? <SearchPalette onSelect={symbol => { dispatch(setSelectedSymbol(symbol)); close(); }}/> : null}
      {openMenu === "layout" ? <div className={`${MENU_PANEL} left-2 right-auto max-h-[calc(100dvh-48px)] w-72 overflow-y-auto p-2 sm:left-20`}>
        <p className="px-2 py-2 text-terminal-muted">Çalışma alanı</p>
        <button type="button" onClick={() => { dispatch(requestLayoutReset()); close(); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-terminal-hover"><RotateCcw className="size-4"/>Varsayılan düzeni yükle</button>
        <p className="px-2 py-2 text-[11px] leading-relaxed text-terminal-muted">Panelleri başlıklarından taşıyabilir, kenarlarından boyutlandırabilirsin.</p>
        <WorkspaceViews/>
      </div> : null}
      {openMenu === "modules" || exitingMenus.includes("modules") ? <SideDrawer title="Modül ekle" onClose={() => closeDrawer("modules")} closeLabel="Modül panelini kapat" compact>
        <ModuleCatalog/>
      </SideDrawer> : null}
      {openMenu === "account" || exitingMenus.includes("account") ? <UserMenu onClose={() => closeDrawer("account")}/> : null}
      {openMenu === "support" ? <section role="dialog" aria-label="Terminal Lab Destek" className={`${MENU_PANEL} max-h-[calc(100dvh-48px)] w-80 max-w-[calc(100vw-16px)] overflow-y-auto p-4 text-xs`}>
        <div className="mb-4 flex items-center gap-2"><LifeBuoy aria-hidden className="size-4 text-terminal-accent-soft"/><h2 className="text-sm font-medium">Terminal Lab Destek</h2><button type="button" aria-label="Desteği kapat" onClick={close} className="ml-auto rounded px-2 py-1 text-terminal-muted hover:bg-terminal-hover">×</button></div>
        <p className="mb-3 text-terminal-muted">Çalışma alanını kullanmaya başla</p>
        <ul className="space-y-3 leading-relaxed">
          <li><strong>Sembol ara</strong><p className="text-terminal-muted">⌘K / Ctrl+K ile aramayı aç ve bir varlık seç.</p></li>
          <li><strong>Çalışma alanını düzenle</strong><p className="text-terminal-muted">Modülleri başlığın boş alanından taşı; kenar ve köşelerinden boyutlandır.</p></li>
          <li><strong>Modül ekle</strong><p className="text-terminal-muted">Üst menüden modül ekle, görünüm menüsünden düzenini kaydet.</p></li>
        </ul>
        <a href="https://github.com/semihbceylan/atlas-clone/issues" target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-between rounded border border-terminal-border px-3 py-2 hover:bg-terminal-hover">Sorun bildir / Öneri paylaş<ExternalLink aria-hidden className="size-3.5"/></a>
        <p className="mt-3 text-[11px] leading-relaxed text-terminal-muted">Bağımsız demo projesidir. Canlı müşteri desteği veya Midas hesap desteği sunulmaz. Emirler simülasyondur.</p>
      </section> : null}
      {openMenu === "notifications" || exitingMenus.includes("notifications") ? <SideDrawer title="Bildirimler" onClose={() => closeDrawer("notifications")} closeLabel="Bildirimleri kapat"><div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 text-center"><Bell aria-hidden className="size-8 text-terminal-subtle"/><p className="text-sm">Henüz bir bildirimin bulunmuyor.</p><p className="max-w-60 text-xs leading-relaxed text-terminal-muted">Bildirimlerin burada görüntülenir.</p></div></SideDrawer> : null}
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
