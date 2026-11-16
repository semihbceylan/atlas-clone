"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAppSelector } from "@/store/hooks";
import { loadLayout, saveLayout, clearLayout, sanitiseLayout } from "@/lib/storage/layout-storage";

const KEY = "terminal-lab.views.v1";
const ACTIVE = "terminal-lab.view-name.v1";
const subscribe = (listener: () => void) => { window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); };
const snapshot = () => localStorage.getItem(ACTIVE) ?? "İlk görünüm";
export function useViewName() { return useSyncExternalStore(subscribe, snapshot, () => "İlk görünüm"); }
interface View { id: string; name: string; layout: ReturnType<typeof loadLayout>; modules: string[]; copies: string[] }
function readViews(): View[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(view => view && typeof view.id === "string" && typeof view.name === "string" && Array.isArray(view.modules) && Array.isArray(view.copies) && (view.layout === null || Array.isArray(view.layout))).slice(0, 20) : [];
  } catch { return []; }
}
function captureCurrentView(views: View[]): View[] {
  const name = snapshot();
  const current = views.find(view => view.name === name);
  const modules = JSON.parse(localStorage.getItem("terminal-lab.modules.v1") ?? '["chart","positions","watchlist"]');
  const copies = JSON.parse(localStorage.getItem("terminal-lab.copies.v1") ?? "[]");
  const saved: View = { id: current?.id ?? crypto.randomUUID(), name, layout: loadLayout(), modules, copies };
  return current ? views.map(view => view.id === current.id ? saved : view) : [...views, saved];
}
function switchWorkspaceView(view: View) {
  localStorage.setItem(KEY, JSON.stringify(captureCurrentView(readViews())));
  const layout = sanitiseLayout(view.layout);
  if (layout) saveLayout(layout);
  else clearLayout();
  localStorage.setItem("terminal-lab.modules.v1", JSON.stringify(view.modules));
  localStorage.setItem("terminal-lab.copies.v1", JSON.stringify(view.copies));
  localStorage.setItem(ACTIVE, view.name);
  window.location.reload();
}
const viewsSnapshot = () => localStorage.getItem(KEY) ?? "[]";
export function WorkspaceViewTabs({ onMenu, expanded }: { onMenu: () => void; expanded: boolean }) {
  const hydrated = useHydrated();
  const active = useViewName();
  const raw = useSyncExternalStore(subscribe, viewsSnapshot, () => "[]");
  const [error, setError] = useState("");
  const views = hydrated && raw !== "[]" ? readViews() : [];
  const tabs = views.some(view => view.name === active) ? views : [...views, { id: "current", name: active }];
  return <><div role="tablist" aria-label="Çalışma alanı görünümleri" className="flex min-w-0 items-stretch overflow-x-auto">{tabs.map((view, index) => <div key={view.id} className={`flex shrink-0 items-stretch border-x border-terminal-border ${view.name === active ? "bg-terminal-panel-alt" : ""}`}>
    <button type="button" role="tab" aria-selected={view.name === active} aria-label={view.name} onClick={() => { if ("modules" in view) { try { switchWorkspaceView(view); } catch { setError("Görünüm değiştirilemedi."); } } }} className="flex max-w-44 items-center gap-2 px-2.5 text-xs hover:bg-terminal-hover"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-terminal-bg text-[11px]">{index + 1}</span><span className="truncate">{view.name}</span></button>
    {view.name === active ? <button type="button" aria-label="Görünüm seçenekleri" aria-expanded={expanded} onClick={onMenu} className="px-1.5 hover:bg-terminal-hover"><ChevronDown aria-hidden className="size-3 text-terminal-muted"/></button> : null}
  </div>)}</div>{error ? <span role="alert">{error}</span> : null}</>;
}
export function createWorkspaceView() {
  const views = captureCurrentView(readViews());
  if (views.length >= 20) throw new Error("En fazla 20 görünüm kaydedilebilir.");
  const currentName = snapshot();
  let name = "Yeni görünüm";
  for (let n = 2; views.some(view => view.name === name) || name === currentName; n++) name = `Yeni görünüm ${n}`;
  localStorage.setItem(KEY, JSON.stringify([...views, { id: crypto.randomUUID(), name, layout: null, modules: [], copies: [] }]));
  localStorage.setItem(ACTIVE, name);
  localStorage.setItem("terminal-lab.modules.v1", "[]");
  localStorage.setItem("terminal-lab.copies.v1", "[]");
  clearLayout();
  window.location.reload();
}

export function WorkspaceStarter() {
  const [error, setError] = useState("");
  const start = (modules: string[]) => {
    try {
      localStorage.setItem("terminal-lab.modules.v1", JSON.stringify(modules));
      const views = readViews().map(view => view.name === snapshot() ? { ...view, modules } : view);
      localStorage.setItem(KEY, JSON.stringify(views));
      clearLayout();
      window.location.reload();
    } catch { setError("Görünüm oluşturulamadı. Tarayıcı depolamasını kontrol et."); }
  };
  return <div className="flex h-full flex-col items-center justify-center gap-6 overflow-auto p-6 text-center">
    <h2 className="text-xl font-medium">Yeni görünüm</h2>
    <button onClick={() => window.dispatchEvent(new Event("atlas:modules"))} className="flex w-72 max-w-full flex-col items-center gap-2 rounded-lg border border-terminal-border bg-terminal-panel/60 p-6 hover:bg-terminal-hover"><span className="text-2xl">+</span><span>Modül ekle</span><span className="text-xs text-terminal-muted">Kendi görünümünü oluştur</span></button>
    <h3 className="text-sm text-terminal-muted">Hazır görünüm ile başla</h3>
    <div className="flex flex-wrap justify-center gap-3">{[
      { name: "Aktif yatırım", modules: ["chart", "watchlist", "positions"] },
      { name: "Portföy takibi", modules: ["portfolio", "positions", "orders"] },
      { name: "Kripto", modules: ["chart", "watchlist", "details"] },
    ].map(template => <button key={template.name} aria-label={`Hazır görünüm seç: ${template.name}`} onClick={() => start(template.modules)} className="rounded-lg border border-terminal-border bg-terminal-panel/60 px-5 py-4 text-sm hover:bg-terminal-hover">{template.name}</button>)}</div>
    {error ? <p role="alert" className="text-xs text-terminal-down">{error}</p> : null}
  </div>;
}
export function WorkspaceViews() {
  const modules = useAppSelector(state => state.terminal.visibleModules);
  const [views, setViews] = useState(readViews);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const write = (next: View[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); setViews(next); setError(""); return true; }
    catch { setError("Görünüm kaydedilemedi. Tarayıcı depolaması kullanılamıyor."); return false; }
  };
  const save = () => {
    let copies: string[] = [];
    try { copies = JSON.parse(localStorage.getItem("terminal-lab.copies.v1") ?? "[]"); } catch { /* Empty copies. */ }
    const cleanName = name.trim().slice(0, 60);
    const existing = views.find(view => view.name === cleanName);
    const view: View = { id: existing?.id ?? crypto.randomUUID(), name: cleanName, layout: loadLayout(), modules, copies };
    if (write([...views.filter(item => item.id !== view.id), view])) {
      localStorage.setItem(ACTIVE, cleanName); window.dispatchEvent(new Event("storage")); setName("");
    }
  };
  const load = (view: View) => {
    try {
      switchWorkspaceView(view);
    } catch { setError("Görünüm yüklenemedi."); }
  };
  return <div className="border-t border-terminal-border p-2 text-xs">
    <label className="block text-terminal-muted">Görünüm adı<input aria-label="Görünüm adı" value={name} maxLength={60} onChange={e => setName(e.target.value)} className="my-2 w-full rounded border border-terminal-border bg-terminal-bg p-2"/></label>
    <button onClick={save} disabled={!name.trim() || (views.length >= 20 && !views.some(view => view.name === name.trim()))} className="mb-2 rounded bg-terminal-accent px-3 py-2 disabled:opacity-40">Görünümü kaydet</button>
    {views.map(view => <div key={view.id} className="flex items-center border-t border-terminal-border"><button onClick={() => load(view)} className="min-w-0 flex-1 truncate p-2 text-left hover:bg-terminal-hover">{view.name}</button><button aria-label={`${view.name} görünümünü sil`} onClick={() => { if (window.confirm("Kayıtlı görünüm silinsin mi?")) write(views.filter(item => item.id !== view.id)); }} className="p-2 text-terminal-down">Sil</button></div>)}
    <p className="py-2 text-[10px] text-terminal-muted">Düzen, modüller ve kopyalar yerel kaydedilir. Aynı adla kaydetmek görünümü günceller. Yüklemek sayfayı yeniler; oturumdaki simüle işlemler sıfırlanır.</p>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
