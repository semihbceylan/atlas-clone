"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Star, X } from "lucide-react";

import { IconButton } from "@/components/terminal/icon-button";
import { Popover } from "@/components/terminal/popover";
import { WidgetFrame } from "@/components/terminal/widget-frame";
import { getSymbolInfo, WATCHLIST_CATALOG } from "@/config/market-symbols";
import { formatPercent, formatPrice } from "@/lib/format-price";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addToWatchlist,
  removeFromWatchlist,
  selectSelectedSymbol,
  selectWatchlist,
  setSelectedSymbol,
  createWatchlist, selectWatchlistById, renameWatchlist, deleteWatchlist,
} from "@/store/slices/terminal-slice";
import { isCoinbaseLiveEnabled } from "@/lib/market/create-coinbase-feed";
import { useLivePrice, type LiveMarketApi } from "@/hooks/use-live-candles";
import type { WatchlistItem } from "@/types/market";

/**
 * "Takip Ettiklerim" widget.
 *
 * Starts empty (matching the reference) and offers two ways to populate it:
 * a one-click demo symbol button in the empty state, and a picker listing the
 * simulated instrument catalogue. Selecting a row also switches the chart.
 */
export function WatchlistWidget({ api }: { api: LiveMarketApi }) {
  const quote = useLivePrice(api);
  const dispatch = useAppDispatch();
  const watchlist = useAppSelector(selectWatchlist);
  const selectedSymbol = useAppSelector(selectSelectedSymbol);
  const lists = useAppSelector(state => state.terminal.watchlists);
  const activeList = useAppSelector(state => state.terminal.activeWatchlist);
  const [listName, setListName] = useState("");
  const [market, setMarket] = useState("all");
  const [sort, setSort] = useState("manual");
  const rows = watchlist.filter(item => market === "all" || getSymbolInfo(item.symbol).exchange === market).toSorted((a, b) => sort === "symbol" ? a.symbol.localeCompare(b.symbol) : sort === "change" ? b.changePercent - a.changePercent : 0);

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  const availableSymbols = useMemo(() => {
    const tracked = new Set(watchlist.map((item) => item.symbol));
    return WATCHLIST_CATALOG.filter((item) => !tracked.has(item.symbol));
  }, [watchlist]);

  const addSymbol = useCallback(
    (item: WatchlistItem) => {
      dispatch(addToWatchlist(item));
      dispatch(setSelectedSymbol(item.symbol));
      setPickerOpen(false);
    },
    [dispatch],
  );


  const actions = (
    <div ref={pickerRef} className="relative">
      <IconButton
        label="Sembol ekle"
        icon={pickerOpen ? <ChevronDown className="size-3.5" /> : <Plus className="size-3.5" />}
        size="sm"
        active={pickerOpen}
        onClick={() => setPickerOpen((open) => !open)}
      />

      {pickerOpen ? (
        <Popover
          anchorRef={pickerRef}
          onClose={closePicker}
          role="menu"
          ariaLabel="Sembol ekle"
          align="end"
          // Fixed/portalled: escapes the widget's `overflow: hidden` and the
          // scrolling grid, and flips up when it would leave the viewport.
          className="z-50 w-60 overflow-hidden rounded-lg border border-terminal-border-strong bg-terminal-elevated shadow-2xl"
        >
          <p className="border-b border-terminal-border px-3 py-1.5 text-[10px] font-medium tracking-wide text-terminal-subtle uppercase">
            Sembol ekle
          </p>
          <ul className="max-h-60 overflow-y-auto py-1">
            {availableSymbols.length === 0 ? (
              <li className="px-3 py-2 text-[11px] text-terminal-muted">
                Katalogdaki tüm semboller eklendi.
              </li>
            ) : (
              availableSymbols.map((item) => (
                <li key={item.symbol}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => addSymbol(item)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-terminal-hover"
                  >
                    <span className="text-[11.5px] font-semibold text-terminal-text">
                      {item.symbol}
                    </span>
                    <span className="truncate text-[10.5px] text-terminal-muted">{item.name}</span>
                    <span
                      className={`ml-auto font-mono text-[10.5px] tabular-nums ${
                        item.changePercent >= 0 ? "text-terminal-up" : "text-terminal-down"
                      }`}
                    >
                      {getSymbolInfo(item.symbol).currency === "USD" ? (isCoinbaseLiveEnabled(item.symbol) ? "Canlı · USD" : "Demo · USD") : formatPercent(item.changePercent)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Popover>
      ) : null}
    </div>
  );

  return (
    <WidgetFrame title="Takip Ettiklerim" actions={actions}>
      <div className="flex flex-wrap gap-1 border-b border-terminal-border p-2 text-[11px]">
        <select aria-label="Takip listesi seç" value={activeList} onChange={e => dispatch(selectWatchlistById(e.target.value))} className="min-w-0 bg-terminal-bg p-1">{lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select>
        <input aria-label="Takip listesi adı" value={listName} onChange={e => setListName(e.target.value)} maxLength={60} placeholder="Liste adı" className="w-24 min-w-0 bg-terminal-bg p-1"/>
        <button disabled={!listName.trim() || lists.length >= 20} onClick={() => { dispatch(createWatchlist({ id: crypto.randomUUID(), name: listName })); setListName(""); }} className="disabled:opacity-40">Yeni liste</button>
        <button disabled={!listName.trim()} onClick={() => { dispatch(renameWatchlist(listName)); setListName(""); }} className="disabled:opacity-40">Yeniden adlandır</button>
        <button disabled={lists.length <= 1} onClick={() => { if (window.confirm("Seçili takip listesi silinsin mi?")) dispatch(deleteWatchlist()); }} className="text-terminal-down disabled:opacity-40">Takip listesini sil</button>
        <select aria-label="Takip listesi piyasası" value={market} onChange={e => setMarket(e.target.value)} className="bg-terminal-bg p-1"><option value="all">Tümü</option><option value="BIST">Yatırım</option><option value="Coinbase">Kripto</option></select>
        <select aria-label="Takip listesi sıralaması" value={sort} onChange={e => setSort(e.target.value)} className="bg-terminal-bg p-1"><option value="manual">Ekleme sırası</option><option value="symbol">Sembol A–Z</option><option value="change">Değişim ↓</option></select>
      </div>
      {watchlist.length === 0 ? (
        <WatchlistEmptyState onAddSymbol={() => setPickerOpen(true)} />
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {rows.map((item) => {
              const isSelected = item.symbol === selectedSymbol;
              const isCrypto = getSymbolInfo(item.symbol).currency === "USD";
              const rowPrice = isSelected ? quote.price : item.price;

              return (
                <div
                  key={item.symbol}
                  data-search-symbol={`${item.symbol} ${item.name}`}
                  className={`group flex items-center gap-2 border-b border-terminal-border/60 px-3 py-2 ${
                    isSelected ? "bg-terminal-accent/10" : "hover:bg-terminal-hover/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => dispatch(setSelectedSymbol(item.symbol))}
                    aria-current={isSelected ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${
                        isSelected ? "bg-terminal-accent-soft" : "bg-transparent"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold text-terminal-text">
                        {item.symbol}
                      </span>
                      <span data-company-name className="block truncate text-[10px] text-terminal-muted">
                        {item.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[11px] tabular-nums text-terminal-text">
                        {rowPrice ? `${isCrypto ? "$" : ""}${formatPrice(rowPrice, { suffix: "" })}` : "—"}
                      </span>
                      <span
                        className={`block font-mono text-[10px] tabular-nums ${
                          item.changePercent >= 0 ? "text-terminal-up" : "text-terminal-down"
                        }`}
                      >
                        {isSelected ? formatPercent(quote.changePercent) : isCrypto ? "USD" : formatPercent(item.changePercent)}
                      </span>
                    </span>
                  </button>

                  <IconButton
                    label={`${item.symbol} sembolünü listeden çıkar`}
                    icon={<X className="size-3.5" />}
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => dispatch(removeFromWatchlist(item.symbol))}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-terminal-border px-3 py-1.5">
            <span className="text-[10px] text-terminal-subtle">
              {watchlist.length} sembol izleniyor
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-[10px] font-medium text-terminal-accent-soft hover:underline"
            >
              Sembol ekle
            </button>
          </div>
        </div>
      )}
    </WidgetFrame>
  );
}

function WatchlistEmptyState({ onAddSymbol }: { onAddSymbol: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
      <span className="flex size-9 items-center justify-center rounded-full border border-terminal-border bg-terminal-panel-alt">
        <Star className="size-4 text-terminal-subtle" />
      </span>
      <p className="text-[13px] font-medium text-terminal-text">Henüz varlık eklenmedi</p>
      <p className="max-w-[220px] text-[12px] leading-relaxed text-terminal-muted">
        Takip etmek istediğin varlıkları ekleyerek başla
      </p>
      <button type="button" onClick={onAddSymbol} className="mt-1 text-[12px] text-terminal-accent-soft hover:underline">Varlık ekle</button>
    </div>
  );
}
