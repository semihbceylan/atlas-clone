"use client";

import { useState } from "react";
import { TOOL_LABELS, type Drawing } from "@/lib/chart/drawings";

const control = "rounded border border-terminal-border bg-terminal-bg p-1 text-[11px] disabled:opacity-40";
export function DrawingProperties({ row, onChange, onDelete, onDuplicate, onLayer, onClose }: {
  row: Drawing; onChange: (patch: Partial<Drawing>) => void; onDelete: () => void;
  onDuplicate: () => void; onLayer: (front: boolean) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState("style");
  const filled = ["rectangle", "ellipse", "gann-box", "measure", "price-range", "date-range"].includes(row.tool);
  const textual = ["text", "callout", "price-label"].includes(row.tool);
  return <section role="dialog" aria-label="Çizim özellikleri" onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} className="absolute right-2 top-2 z-30 max-h-[calc(100%-16px)] w-64 max-w-[95%] overflow-y-auto rounded border border-terminal-border-strong bg-terminal-elevated p-3 text-[11px] shadow-xl">
    <div className="mb-2 flex justify-between gap-2"><strong>{TOOL_LABELS[row.tool]}</strong><button aria-label="Çizim özelliklerini kapat" onClick={onClose}>×</button></div>
    <div role="tablist" aria-label="Çizim ayarları" className="mb-3 flex gap-2"><button role="tab" aria-selected={tab === "style"} onClick={() => setTab("style")} className={control}>Stil</button><button role="tab" aria-selected={tab === "coordinates"} onClick={() => setTab("coordinates")} className={control}>Koordinatlar</button></div>
    {tab === "style" ? <div className="grid grid-cols-2 items-center gap-2">
      <label htmlFor={`color-${row.id}`}>Çizgi rengi</label><input id={`color-${row.id}`} type="color" aria-label="Seçili çizimin rengi" value={row.color} disabled={row.locked} onChange={e => onChange({ color: e.target.value })} className="h-6 w-full"/>
      <label htmlFor={`width-${row.id}`}>Kalınlık</label><select id={`width-${row.id}`} aria-label="Çizgi kalınlığı" value={row.lineWidth ?? (row.tool === "highlighter" ? 10 : 2)} disabled={row.locked} onChange={e => onChange({ lineWidth: Number(e.target.value) })} className={control}>{[1, 2, 3, 4, 5, 6, 8, 10].map(width => <option key={width} value={width}>{width} px</option>)}</select>
      <label htmlFor={`style-${row.id}`}>Çizgi stili</label><select id={`style-${row.id}`} aria-label="Çizgi stili" value={row.lineStyle ?? "solid"} disabled={row.locked} onChange={e => onChange({ lineStyle: e.target.value as Drawing["lineStyle"] })} className={control}><option value="solid">Düz</option><option value="dashed">Kesikli</option><option value="dotted">Noktalı</option></select>
      <label htmlFor={`opacity-${row.id}`}>Opaklık</label><input id={`opacity-${row.id}`} aria-label="Çizim opaklığı" type="range" min="0.05" max="1" step="0.05" value={row.opacity ?? (row.tool === "highlighter" ? 0.3 : 1)} disabled={row.locked} onChange={e => onChange({ opacity: Number(e.target.value) })}/>
      {filled ? <><label htmlFor={`fill-${row.id}`}>Dolgu rengi</label><input id={`fill-${row.id}`} aria-label="Dolgu rengi" type="color" value={row.fillColor ?? row.color} disabled={row.locked} onChange={e => onChange({ fillColor: e.target.value })} className="h-6 w-full"/><label htmlFor={`fill-opacity-${row.id}`}>Dolgu opaklığı</label><input id={`fill-opacity-${row.id}`} aria-label="Dolgu opaklığı" type="range" min="0" max="1" step="0.05" value={row.fillOpacity ?? 0.09} disabled={row.locked} onChange={e => onChange({ fillOpacity: Number(e.target.value) })}/></> : null}
      {textual ? <><label htmlFor={`font-${row.id}`}>Yazı boyutu</label><input id={`font-${row.id}`} aria-label="Çizim yazı boyutu" type="number" min="8" max="48" value={row.fontSize ?? 11} disabled={row.locked} onChange={e => onChange({ fontSize: Math.min(48, Math.max(8, Number(e.target.value) || 11)) })} className={control}/></> : null}
      {["text", "callout"].includes(row.tool) ? <label className="col-span-2">Metin<textarea aria-label="Seçili çizimin metni" maxLength={200} value={row.text} disabled={row.locked} onChange={e => onChange({ text: e.target.value })} className={`${control} mt-1 w-full`}/></label> : null}
    </div> : <div className="space-y-2"><p className="text-terminal-muted">Unix zamanı (saniye) ve fiyat. Değişiklik uygulandığında kaydedilir.</p>{row.points.length > 2 ? <p>Serbest çizim: {row.points.length} nokta. Başlangıç/bitiş noktaları düzenlenebilir.</p> : null}{row.points.map((point, index) => ({ point, index })).filter(({ index }) => row.points.length <= 2 || index === 0 || index === row.points.length - 1).map(({ point, index }) => <CoordinateEditor key={`${row.id}:${index}:${point.time}:${point.price}`} index={index} point={point} locked={row.locked} onApply={next => onChange({ points: row.points.map((value, i) => i === index ? next : value) })}/>)}</div>}
    <div className="mt-3 flex flex-wrap gap-2 border-t border-terminal-border pt-2">
      <button aria-pressed={!!row.locked} onClick={() => onChange({ locked: !row.locked })} className={control}>{row.locked ? "Kilidi aç" : "Kilitle"}</button>
      <button onClick={onDuplicate} className={control}>Çizimi çoğalt</button><button disabled={row.locked} onClick={() => onLayer(true)} className={control}>Öne getir</button><button disabled={row.locked} onClick={() => onLayer(false)} className={control}>Arkaya gönder</button>
      <button onClick={() => onChange({ hidden: !row.hidden })} className={control}>{row.hidden ? "Çizimi göster" : "Çizimi gizle"}</button>
      <button disabled={row.locked} onClick={onDelete} className={`${control} text-terminal-down`}>Seçileni sil</button><button onClick={onClose} className={control}>Kapat</button>
    </div>
  </section>;
}
function CoordinateEditor({ point, index, locked, onApply }: { point: Drawing["points"][number]; index: number; locked?: boolean; onApply: (point: Drawing["points"][number]) => void }) {
  const [time, setTime] = useState(String(point.time));
  const [price, setPrice] = useState(String(point.price));
  return <form onSubmit={e => { e.preventDefault(); if (time.trim() && price.trim() && Number.isFinite(Number(time)) && Number.isFinite(Number(price))) onApply({ time: Number(time), price: Number(price) }); }} className="grid grid-cols-2 gap-1"><label>Zaman {index + 1}<input aria-label={`Nokta ${index + 1} zamanı`} type="number" step="any" required disabled={locked} value={time} onChange={e => setTime(e.target.value)} className={`${control} w-full`}/></label><label>Fiyat {index + 1}<input aria-label={`Nokta ${index + 1} fiyatı`} type="number" step="any" required disabled={locked} value={price} onChange={e => setPrice(e.target.value)} className={`${control} w-full`}/></label><button disabled={locked} className={`${control} col-span-2`}>Nokta {index + 1} uygula</button></form>;
}
