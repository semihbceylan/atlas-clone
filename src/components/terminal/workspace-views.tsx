"use client";

import { useState, useSyncExternalStore } from "react";
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
      const layout = sanitiseLayout(view.layout);
      if (layout) saveLayout(layout);
      else clearLayout();
      localStorage.setItem("terminal-lab.modules.v1", JSON.stringify(view.modules));
      localStorage.setItem("terminal-lab.copies.v1", JSON.stringify(view.copies));
      localStorage.setItem(ACTIVE, view.name);
      window.location.reload();
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
