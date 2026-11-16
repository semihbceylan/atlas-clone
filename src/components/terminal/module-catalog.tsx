"use client";

import { WIDGET_LABELS, type WidgetId } from "@/config/default-layout";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleModule } from "@/store/slices/terminal-slice";

const cards: { id?: WidgetId; label: string; preview: string }[] = [
  { id: "watchlist", label: "Takip listesi", preview: "table" },
  { id: "screener", label: "Hisse tarayıcı", preview: "table" },
  { id: "chart", label: "Gelişmiş grafik", preview: "chart" },
  { id: "portfolio", label: "Portföy", preview: "portfolio" },
  { id: "positions", label: "Pozisyonlar", preview: "table" },
  { id: "orders", label: "Emir geçmişi", preview: "table" },
  { label: "Midas Pro", preview: "table" },
  { id: "news", label: "Haberler", preview: "news" },
  { id: "details", label: "Varlık detayı", preview: "chart" },
  { label: "Opsiyon zinciri", preview: "table" },
  { label: "Opsiyon, VİOP & Varant trendleri", preview: "chart" },
  { label: "Varant zinciri", preview: "table" },
];

/** Decorative miniatures, not live market data. */
function ModulePreview({ kind }: { kind: string }) {
  return <svg aria-hidden="true" viewBox="0 0 168 96" className="h-24 w-full text-terminal-muted" fill="none">
    <rect x="12" y="13" width="156" height="88" rx="4" className="fill-terminal-panel stroke-terminal-border"/>
    <rect x="21" y="22" width="43" height="4" rx="2" fill="currentColor" opacity=".4"/>
    <circle cx="146" cy="24" r="2" fill="currentColor" opacity=".35"/>
    {kind === "chart" ? <>
      {[43, 61, 79].map(y => <path key={y} d={`M21 ${y}H160`} className="stroke-terminal-border"/>)}
      <path d="M21 82 33 71 44 75 55 58 67 64 78 46 90 54 103 39 114 45 127 32 139 41 160 30" className="stroke-terminal-accent" strokeWidth="2"/>
    </> : kind === "portfolio" ? <>
      <circle cx="54" cy="64" r="22" className="stroke-terminal-border" strokeWidth="9"/>
      <circle cx="54" cy="64" r="22" className="stroke-terminal-accent" strokeWidth="9" strokeDasharray="91 139" transform="rotate(-90 54 64)"/>
      {[46, 61, 76].map(y => <rect key={y} x="92" y={y} width={y === 46 ? 52 : 39} height="4" rx="2" fill="currentColor" opacity=".3"/>)}
    </> : kind === "news" ? <>
      {[38, 61, 84].map(y => <g key={y}><rect x="22" y={y} width="24" height="16" rx="2" className="fill-terminal-hover"/><rect x="53" y={y + 2} width="96" height="3" rx="1.5" fill="currentColor" opacity=".35"/><rect x="53" y={y + 10} width="68" height="3" rx="1.5" fill="currentColor" opacity=".2"/></g>)}
    </> : <>
      {[40, 56, 72, 88].map((y, i) => <g key={y}><path d={`M21 ${y + 10}H160`} className="stroke-terminal-border"/><rect x="22" y={y} width="31" height="4" rx="2" fill="currentColor" opacity=".35"/><rect x="76" y={y} width="28" height="4" rx="2" fill="currentColor" opacity=".25"/><rect x="121" y={y} width="30" height="4" rx="2" className={i % 3 ? "fill-terminal-up" : "fill-terminal-down"} opacity=".65"/></g>)}
    </>}
  </svg>;
}

export function ModuleCatalog() {
  const dispatch = useAppDispatch();
  const visible = useAppSelector(state => state.terminal.visibleModules);
  return <div className="grid grid-cols-2 gap-2.5" aria-label="Modüller">
    {cards.map(({ id, label, preview }) => <button key={label} type="button"
      disabled={!id} title={!id ? "Bu modül demoda mevcut değil" : undefined}
      aria-label={id ? `${WIDGET_LABELS[id]} ${visible.includes(id) ? "Kaldır" : "Ekle"}` : `${label} — demoda mevcut değil`}
      aria-pressed={id ? visible.includes(id) : undefined}
      onClick={() => { if (id) dispatch(toggleModule(id)); }}
      className="relative flex h-[136px] w-full flex-col items-start gap-2 overflow-hidden rounded-sm bg-terminal-elevated text-left shadow-xs transition-colors hover:bg-terminal-hover focus-visible:outline-2 focus-visible:outline-terminal-accent disabled:cursor-not-allowed disabled:opacity-45">
      <div className="h-24 w-full shrink-0 overflow-hidden"><ModulePreview kind={preview}/></div>
      <span className={`w-full px-2.5 pb-1.5 pt-1 font-normal leading-4 ${label.length > 25 ? "text-[11px]" : "text-sm"}`}>{label}</span>
      {id === "screener" ? <span className="absolute right-2 top-2 rounded-full bg-terminal-up/20 px-2 py-0.5 text-xs font-medium text-terminal-up">Yeni</span> : null}
    </button>)}
  </div>;
}
