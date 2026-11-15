"use client";

import { useState } from "react";
import { WidgetFrame } from "@/components/terminal/widget-frame";
import { useAppSelector } from "@/store/hooks";

interface Article { title: string; url: string; source: string; publishedAt: string; symbols: string[] }
function parseArticles(value: unknown): Article[] {
  if (!Array.isArray(value)) throw new Error("JSON bir haber listesi içermeli.");
  return value.slice(0, 500).map(item => {
    if (!item || typeof item.title !== "string" || typeof item.url !== "string" || typeof item.source !== "string" || !Number.isFinite(Date.parse(item.publishedAt)) || !Array.isArray(item.symbols) || !item.symbols.every((symbol: unknown) => typeof symbol === "string")) throw new Error("Her haber title, url, source, publishedAt ve symbols alanlarını içermeli.");
    const url = new URL(item.url);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Haber bağlantıları HTTPS olmalı.");
    return { title: item.title.slice(0, 500), url: url.href, source: item.source.slice(0, 100), publishedAt: item.publishedAt, symbols: item.symbols };
  });
}
export function NewsWidget() {
  const symbol = useAppSelector(state => state.terminal.selectedSymbol);
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState("");
  const rows = articles.filter(article => (!linked || article.symbols.includes(symbol)) && `${article.title} ${article.source}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"))).toSorted((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return <WidgetFrame title="Haberler" bodyClassName="overflow-auto p-3">
    <p className="mb-3 text-xs text-terminal-muted">Canlı haber sağlayıcısı bağlı değil. Kendi haber dosyanı içe aktar; içerik yalnızca bu oturumda tutulur.</p>
    <div className="flex flex-wrap gap-2 text-xs"><input aria-label="Haberlerde ara" value={query} onChange={e => setQuery(e.target.value)} placeholder="Haber ara" className="rounded border border-terminal-border bg-terminal-bg p-2"/><label className="p-2"><input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)}/> Yalnızca {symbol}</label><label className="rounded border border-terminal-border p-2">JSON içe aktar<input aria-label="Haber dosyası" type="file" accept=".json,application/json" className="block max-w-48" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 2_000_000) throw new Error("Dosya en fazla 2 MB olabilir."); setArticles(parseArticles(JSON.parse(await file.text()))); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Dosya okunamadı."); } e.target.value = ""; }}/></label></div>
    {error ? <p role="alert" className="py-2 text-xs text-terminal-down">{error}</p> : null}
    {!rows.length ? <div className="py-6 text-xs text-terminal-muted"><p>Gösterilecek haber yok.</p><pre className="mt-3 overflow-auto text-[10px]">{'[{"title":"Başlık","url":"https://example.com/article","source":"Kaynak","publishedAt":"2026-11-15T12:00:00Z","symbols":["BTC"]}]'}</pre></div> : rows.map((article, index) => <article key={`${article.url}:${index}`} className="border-b border-terminal-border py-3"><p className="mb-1 text-[10px] text-terminal-muted">{article.source} · {new Date(article.publishedAt).toLocaleString("tr-TR")}</p><a href={article.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:text-terminal-accent-soft">{article.title} ↗</a><p className="mt-1 text-[10px] text-terminal-muted">{article.symbols.join(" · ")}</p></article>)}
  </WidgetFrame>;
}
