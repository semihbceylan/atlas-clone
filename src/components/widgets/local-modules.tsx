"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { WidgetFrame } from "@/components/terminal/widget-frame";
import { SYMBOLS, getSymbolInfo, WATCHLIST_CATALOG } from "@/config/market-symbols";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToWatchlist, setSelectedSymbol } from "@/store/slices/terminal-slice";
import { useLivePrice, type LiveMarketApi } from "@/hooks/use-live-candles";

const number = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const inputClass = "min-w-0 rounded border border-terminal-border bg-terminal-bg px-2 py-1.5 text-xs outline-none focus:border-terminal-accent";

export function ScreenerWidget() {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState("all");
  const [sort, setSort] = useState("symbol");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [showPrice, setShowPrice] = useState(true);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<{ name: string; query: string; exchange: string; sort: string; minimum: string; maximum: string }[]>([]);
  const [presetStatus, setPresetStatus] = useState("");
  const watchlist = useAppSelector(state => state.terminal.watchlist);
  const rows = Object.values(SYMBOLS).filter(item =>
    `${item.symbol} ${item.name}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")) && (exchange === "all" || item.exchange === exchange) && (!minimum || item.referencePrice >= Number(minimum)) && (!maximum || item.referencePrice <= Number(maximum)),
  ).sort((a, b) => sort === "price" ? b.referencePrice - a.referencePrice : a.symbol.localeCompare(b.symbol));
  return <WidgetFrame title="Hisse tarayıcı" bodyClassName="overflow-auto">
    <div className="flex flex-wrap gap-2 p-3">
      <input aria-label="Tarayıcıda ara" placeholder="Sembol veya şirket" value={query} onChange={e => setQuery(e.target.value)} className={inputClass}/>
      <select aria-label="Piyasa filtresi" value={exchange} onChange={e => setExchange(e.target.value)} className={inputClass}><option value="all">Tüm piyasalar</option><option>BIST</option><option>Coinbase</option></select>
      <select aria-label="Tarayıcı sıralaması" value={sort} onChange={e => setSort(e.target.value)} className={inputClass}><option value="symbol">Sembol A–Z</option><option value="price">Referans fiyat ↓</option></select>
    </div>
    <div className="flex flex-wrap items-center gap-2 px-3 pb-3 text-xs">
      <input aria-label="En düşük referans fiyat" type="number" min="0" step="any" value={minimum} onChange={e => setMinimum(e.target.value)} placeholder="En düşük fiyat" className={`${inputClass} w-32`}/>
      <input aria-label="En yüksek referans fiyat" type="number" min="0" step="any" value={maximum} onChange={e => setMaximum(e.target.value)} placeholder="En yüksek fiyat" className={`${inputClass} w-32`}/>
      <label><input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)}/> Fiyat sütunu</label>
      <input aria-label="Tarayıcı adı" maxLength={60} value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Tarayıcı adı" className={`${inputClass} w-32`}/>
      <button disabled={!presetName.trim()} onClick={() => {
        try { const saved: unknown = JSON.parse(localStorage.getItem("terminal-lab.screeners.v1") ?? "[]"); const valid = Array.isArray(saved) ? saved.filter(item => item && ["name", "query", "exchange", "sort", "minimum", "maximum"].every(key => typeof item[key] === "string")) : []; const next = [...valid.filter(item => item.name !== presetName.trim()), { name: presetName.trim(), query, exchange, sort, minimum, maximum }].slice(-20); localStorage.setItem("terminal-lab.screeners.v1", JSON.stringify(next)); setPresets(next); setPresetStatus("Tarayıcı kaydedildi."); }
        catch { setPresetStatus("Tarayıcı kaydedilemedi."); }
      }} className="rounded border border-terminal-border p-2 disabled:opacity-40">Tarayıcı kaydet</button>
      <button onClick={() => { try { const saved: unknown = JSON.parse(localStorage.getItem("terminal-lab.screeners.v1") ?? "[]"); setPresets(Array.isArray(saved) ? saved.filter(item => item && ["name", "query", "exchange", "sort", "minimum", "maximum"].every(key => typeof item[key] === "string")).slice(0, 20) : []); setPresetStatus("Kayıtlı tarayıcılar yüklendi."); } catch { setPresetStatus("Kayıtlar okunamadı."); } }} className="rounded border border-terminal-border p-2">Kayıtları getir</button>
      {presets.length ? <select aria-label="Kayıtlı tarayıcı" value="" onChange={e => { const preset = presets.find(item => item.name === e.target.value); if (preset) { setQuery(preset.query); setExchange(preset.exchange); setSort(preset.sort); setMinimum(preset.minimum); setMaximum(preset.maximum); } }} className={inputClass}><option value="">Tarayıcı yükle</option>{presets.map(item => <option key={item.name}>{item.name}</option>)}</select> : null}
      {presetStatus ? <span role="status">{presetStatus}</span> : null}
    </div>
    <p className="px-3 pb-2 text-[11px] text-terminal-muted">Yerel katalog · Referans fiyatlar, canlı piyasa verisi değildir.</p>
    <table className="w-full text-left text-xs"><thead className="text-terminal-muted"><tr><th className="p-2">Varlık</th>{showPrice ? <th>Referans fiyat</th> : null}<th>Takip</th></tr></thead><tbody>{rows.map(item => <tr key={item.symbol} data-search-symbol={`${item.symbol} ${item.name}`} className="border-t border-terminal-border hover:bg-terminal-hover"><td className="p-2"><button onClick={() => dispatch(setSelectedSymbol(item.symbol))} className="text-left"><b>{item.symbol}</b><span data-company-name className="block text-[10px] text-terminal-muted">{item.name}</span></button></td><td hidden={!showPrice}>{number(item.referencePrice)} {item.currency}</td><td><button disabled={watchlist.some(row => row.symbol === item.symbol)} onClick={() => { const row = WATCHLIST_CATALOG.find(row => row.symbol === item.symbol); if (row) dispatch(addToWatchlist(row)); }} className="rounded border border-terminal-border px-2 py-1 disabled:opacity-40">{watchlist.some(row => row.symbol === item.symbol) ? "Eklendi" : "+ Ekle"}</button></td></tr>)}</tbody></table>
    {!rows.length ? <p className="p-4 text-terminal-muted">Sonuç bulunamadı.</p> : null}
  </WidgetFrame>;
}

export function OrdersWidget() {
  const orders = useAppSelector(state => state.terminal.orders);
  const [side, setSide] = useState("all");
  const [date, setDate] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const filtered = orders.filter(order => (side === "all" || (order.quantity > 0 ? "buy" : "sell") === side) && (!date || order.createdAt.slice(0, 10) === date));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const download = () => {
    const csv = ["time,symbol,side,quantity,price,currency,status", ...orders.map(order => `${order.createdAt},${order.symbol},${order.quantity > 0 ? "buy" : "sell"},${Math.abs(order.quantity)},${order.price},${getSymbolInfo(order.symbol).currency},simulated`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "simulated-orders.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <WidgetFrame title="Emir geçmişi" actions={<button aria-label="Emirleri CSV indir" disabled={!orders.length} onClick={download} className="p-1 disabled:opacity-40"><Download className="size-4"/></button>} bodyClassName="overflow-auto">
    <p className="p-3 text-[11px] text-terminal-muted">Yalnızca bu oturumdaki simüle işlemler · Gerçek emir gönderilmez.</p>
    <div className="flex flex-wrap gap-2 px-3 pb-3"><select aria-label="Emir yönü" value={side} onChange={e => { setSide(e.target.value); setPage(0); }} className={inputClass}><option value="all">Tüm yönler</option><option value="buy">Alış</option><option value="sell">Satış</option></select><input aria-label="Emir tarihi (UTC)" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(0); }} className={inputClass}/><button onClick={() => { setSide("all"); setDate(""); setPage(0); }} className="text-xs">Filtreleri temizle</button></div>
    {!orders.length ? <p className="p-4 text-center text-terminal-muted">Henüz simüle emir yok. Grafikte Al / Sat ile başla.</p> : <table className="w-full text-left text-xs"><thead className="text-terminal-muted"><tr><th className="p-2">Zaman / Varlık</th><th>Yön</th><th>Adet</th><th>Fiyat</th><th>Durum</th><th>Toplam</th></tr></thead><tbody>{visible.map(order => <tr key={order.id} data-search-symbol={order.symbol} className="border-t border-terminal-border"><td className="p-2">{order.symbol}<span className="block text-[10px] text-terminal-muted">{new Date(order.createdAt).toLocaleTimeString("tr-TR")}</span></td><td className={order.quantity > 0 ? "text-terminal-up" : "text-terminal-down"}>{order.quantity > 0 ? "Alış" : "Satış"}</td><td>{number(Math.abs(order.quantity))}</td><td>{number(order.price)} {getSymbolInfo(order.symbol).currency}</td><td>Simüle dolum</td><td>{number(Math.abs(order.quantity) * order.price)} {getSymbolInfo(order.symbol).currency}</td></tr>)}</tbody></table>}
    <div className="flex flex-wrap items-center gap-2 border-t border-terminal-border p-3 text-xs"><span>{filtered.length ? currentPage * pageSize + 1 : 0}–{Math.min(filtered.length, (currentPage + 1) * pageSize)} / {filtered.length}</span><button aria-label="Önceki emir sayfası" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="disabled:opacity-40">Önceki</button><button aria-label="Sonraki emir sayfası" disabled={(currentPage + 1) * pageSize >= filtered.length} onClick={() => setPage(currentPage + 1)} className="disabled:opacity-40">Sonraki</button><select aria-label="Sayfa başına emir" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }} className={inputClass}>{[10, 25, 50, 100].map(size => <option key={size}>{size}</option>)}</select></div>
  </WidgetFrame>;
}

export function PortfolioWidget({ api }: { api: LiveMarketApi }) {
  const quote = useLivePrice(api);
  const symbol = useAppSelector(state => state.terminal.selectedSymbol);
  const positions = useAppSelector(state => state.terminal.positions);
  return <WidgetFrame title="Portföy" bodyClassName="overflow-auto p-3">
    <p className="mb-3 text-[11px] text-terminal-muted">Simüle portföy · Dövizler ayrı gösterilir. Diğer varlıklar maliyetle değerlenir; ücretler dahil değildir.</p>
    {["TRY", "USD"].map(currency => {
      const rows = positions.filter(position => getSymbolInfo(position.symbol).currency === currency);
      const cost = rows.reduce((sum, row) => sum + row.averagePrice * row.quantity, 0);
      const value = rows.reduce((sum, row) => sum + (row.symbol === symbol && quote.price ? quote.price : row.averagePrice) * row.quantity, 0);
      return <div key={currency} className="mb-3 rounded border border-terminal-border p-3"><p className="text-xs text-terminal-muted">{currency} · {rows.length} pozisyon</p><p data-sensitive className="my-2 text-xl tabular-nums">{number(value)} {currency}</p><p data-sensitive className={value - cost >= 0 ? "text-terminal-up" : "text-terminal-down"}>Gerçekleşmemiş K/Z: {number(value - cost)} {currency}</p></div>;
    })}
  </WidgetFrame>;
}

export function DetailsWidget({ api }: { api: LiveMarketApi }) {
  const symbol = useAppSelector(state => state.terminal.selectedSymbol);
  const info = getSymbolInfo(symbol);
  const quote = useLivePrice(api);
  return <WidgetFrame title="Varlık detayı" bodyClassName="overflow-auto p-4">
    <h3 className="text-xl">{symbol} <span data-company-name className="text-sm text-terminal-muted">{info.name}</span></h3>
    <p className="my-3 text-2xl tabular-nums">{quote.price ? number(quote.price) : "—"} {info.currency}</p>
    <dl className="grid grid-cols-2 gap-3 text-xs"><dt className="text-terminal-muted">Piyasa</dt><dd>{info.exchange}</dd><dt className="text-terminal-muted">Para birimi</dt><dd>{info.currency}</dd><dt className="text-terminal-muted">Fiyat adımı</dt><dd>{info.tickSize}</dd><dt className="text-terminal-muted">Referans fiyat (örnek)</dt><dd>{number(info.referencePrice)}</dd></dl>
    <p className="mt-4 text-[11px] text-terminal-muted">Seçili grafikle bağlantılıdır. Veri kaynağı ve bağlantı durumu grafikte gösterilir. Temel analiz / gerçek şirket verisi içermez.</p>
  </WidgetFrame>;
}
