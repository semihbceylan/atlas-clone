"use client";

import { useEffect, useState } from "react";
import { SYMBOLS } from "@/config/market-symbols";
import type { LiveMarketApi } from "@/hooks/use-live-candles";
import { useAppSelector } from "@/store/hooks";
import { evaluateAlerts, parseAlerts, type PriceAlert } from "@/lib/market/price-alerts";

const KEY = "terminal-lab.alerts.v1";
const control = "rounded border border-terminal-border bg-terminal-bg p-2 text-xs";
export function PriceAlerts({ api, open, onClose }: { api: LiveMarketApi; open: boolean; onClose: () => void }) {
  const selectedSymbol = useAppSelector(state => state.terminal.selectedSymbol);
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try { return parseAlerts(JSON.parse(localStorage.getItem(KEY) ?? "[]")); }
    catch { return []; }
  });
  const [symbol, setSymbol] = useState(selectedSymbol);
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [history, setHistory] = useState(false);
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    return api.subscribe(event => {
      const candle = event.type === "reset" ? event.candles.at(-1) : event.candle;
      if (candle) setAlerts(current => evaluateAlerts(current, selectedSymbol, candle.close, new Date().toISOString()));
    });
  }, [api, selectedSymbol]);
  useEffect(() => {
    if (alerts) {
      try { localStorage.setItem(KEY, JSON.stringify(alerts)); }
      catch { /* Session alarms still work when storage is unavailable. */ }
    }
  }, [alerts]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  const rows = (alerts ?? []).filter(alert => !!alert.triggeredAt === history && alert.symbol.toLowerCase().includes(query.toLowerCase()));
  const latest = alerts?.filter(alert => alert.triggeredAt && `${alert.id}:${alert.triggeredAt}` !== dismissed).at(-1);
  return <>
    {latest ? <div role="status" className="fixed right-3 bottom-9 z-40 rounded border border-terminal-accent bg-terminal-elevated p-3 text-xs">Demo alarmı: {latest.symbol} {latest.direction === "above" ? "≥" : "≤"} {latest.target}<button aria-label="Alarm bildirimini kapat" className="ml-3" onClick={() => setDismissed(`${latest.id}:${latest.triggeredAt}`)}>×</button></div> : null}
    {open ? <div className="fixed inset-0 z-[110] flex justify-end bg-black/30" onClick={onClose}><section role="dialog" aria-modal="true" aria-label="Alarmlar" className="flex h-full w-full max-w-md flex-col border-l border-terminal-border bg-terminal-panel p-4" onClick={e => e.stopPropagation()}>
      <div className="mb-4 flex justify-between"><h2>Alarmlar</h2><button autoFocus onClick={onClose} aria-label="Alarmları kapat">×</button></div>
      <p className="mb-4 text-xs text-terminal-muted">Yerel demo alarmları. Yalnızca sayfa açıkken seçili grafiğin fiyatı kontrol edilir. Arka planda bildirim gönderilmez.</p>
      <form className="grid grid-cols-2 gap-2" onSubmit={e => { e.preventDefault(); const price = Number(target); if (!Number.isFinite(price) || price <= 0 || (alerts?.length ?? 0) >= 100) return; setAlerts(current => [...(current ?? []), { id: crypto.randomUUID(), symbol, target: price, direction, triggeredAt: null }]); setTarget(""); }}>
        <select aria-label="Alarm varlığı" className={control} value={symbol} onChange={e => setSymbol(e.target.value)}>{Object.keys(SYMBOLS).map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Alarm koşulu" className={control} value={direction} onChange={e => setDirection(e.target.value as "above" | "below")}><option value="above">Fiyat ≥</option><option value="below">Fiyat ≤</option></select>
        <input required min="0.000001" step="any" type="number" aria-label="Alarm fiyatı" placeholder="Hedef fiyat" className={control} value={target} onChange={e => setTarget(e.target.value)}/>
        <button disabled={!alerts || alerts.length >= 100} className="rounded bg-terminal-accent p-2 text-xs disabled:opacity-40">Alarm ekle</button>
      </form>
      <div className="my-4 flex gap-2"><button aria-pressed={!history} onClick={() => setHistory(false)} className={control}>Aktif</button><button aria-pressed={history} onClick={() => setHistory(true)} className={control}>Geçmiş</button><input aria-label="Alarmlarda ara" value={query} onChange={e => setQuery(e.target.value)} placeholder="Sembol ara" className={`${control} min-w-0 flex-1`}/></div>
      <div className="min-h-0 overflow-auto">{!rows.length ? <p className="p-4 text-center text-xs text-terminal-muted">{history ? "Alarm geçmişi boş" : "Aktif alarm bulunmuyor"}</p> : rows.map(alert => <div key={alert.id} className="flex items-center justify-between border-b border-terminal-border py-3 text-xs"><div>{alert.symbol} {alert.direction === "above" ? "≥" : "≤"} {alert.target}<p className="text-terminal-muted">{alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString("tr-TR") : "Bekliyor"}</p></div><div>{alert.triggeredAt ? <button onClick={() => setAlerts(current => current?.map(item => item.id === alert.id ? { ...item, triggeredAt: null } : item) ?? [])} className="mr-3">Yeniden kur</button> : null}<button aria-label={`${alert.symbol} alarmını sil`} onClick={() => setAlerts(current => current?.filter(item => item.id !== alert.id) ?? [])} className="text-terminal-down">Sil</button></div></div>)}</div>
    </section></div> : null}
  </>;
}
