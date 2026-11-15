"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Logical, UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/types/market";
import { measurement, ONE_POINT_TOOLS, TOOL_LABELS, type Anchor, type ChartTool, type Drawing, type AnnotationTool } from "@/lib/chart/drawings";
import { DrawingProperties } from "./drawing-properties";

export interface DrawingChart { chart: IChartApi; candleSeries: ISeriesApi<"Candlestick"> }
interface Props {
  handles: DrawingChart | null; candles: () => readonly Candle[]; intervalSeconds: number;
  tool: ChartTool; onTool: (tool: ChartTool) => void; rows: Drawing[]; onCommit: (rows: Drawing[]) => void;
  hidden: boolean; magnet: boolean; repeat: boolean; color: string; ready: boolean;
}
type Point = { x: number; y: number };

/** Anchors live in time/price space, never pixels. Reprojection follows pan/zoom/resize. */
export function DrawingOverlay(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const draft = useRef<Drawing | null>(null);
  const drag = useRef<{ id: string; handle: number; start: Anchor; original: Drawing } | null>(null);
  const paths = useRef<{ id: string; path: Path2D; points: Point[] }[]>([]);
  const selected = useRef<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [text, setText] = useState("Not");
  const [message, setMessage] = useState("");
  const [objectsOpen, setObjectsOpen] = useState(false);
  const pick = (id: string | null) => { selected.current = id; setSelection(id); };

  function toAnchor(x: number, y: number): Anchor | null {
    const p = latest.current;
    if (!p.handles) return null;
    const scale = p.handles.chart.timeScale();
    const logical = scale.coordinateToLogical(x);
    const price = p.handles.candleSeries.coordinateToPrice(y);
    const data = p.candles();
    if (logical === null || price === null || !data.length) return null;
    const index = Math.round(logical);
    const bar = data[Math.max(0, Math.min(data.length - 1, index))];
    const time = bar.time + (index < 0 ? index : index >= data.length ? index - data.length + 1 : 0) * p.intervalSeconds;
    const snapped = p.magnet ? [bar.open, bar.high, bar.low, bar.close].reduce((best, value) => Math.abs(value - price) < Math.abs(best - price) ? value : best) : price;
    return { time, price: snapped };
  }

  useEffect(() => {
    let frame = 0;
    const render = () => {
      const node = canvas.current;
      const p = latest.current;
      const ctx = node?.getContext("2d");
      if (!node || !ctx || !p.handles) { frame = requestAnimationFrame(render); return; }
      const w = p.handles.chart.timeScale().width();
      const h = p.handles.chart.paneSize().height;
      const ratio = devicePixelRatio || 1;
      if (node.width !== Math.round(w * ratio) || node.height !== Math.round(h * ratio)) { node.width = Math.round(w * ratio); node.height = Math.round(h * ratio); node.style.width = `${w}px`; node.style.height = `${h}px`; }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, w, h);
      paths.current = [];
      const data = p.candles();
      const project = (a: Anchor): Point | null => {
        let x = p.handles!.chart.timeScale().timeToCoordinate(a.time as UTCTimestamp);
        if (x === null && data.length) {
          let low = 0, high = data.length - 1;
          while (low < high) { const mid = Math.floor((low + high) / 2); if (data[mid].time < a.time) low = mid + 1; else high = mid; }
          const index = a.time < data[0].time ? (a.time - data[0].time) / p.intervalSeconds
            : a.time > data[data.length - 1].time ? data.length - 1 + (a.time - data[data.length - 1].time) / p.intervalSeconds
            : low === 0 ? 0 : low - 1 + (a.time - data[low - 1].time) / (data[low].time - data[low - 1].time);
          x = p.handles!.chart.timeScale().logicalToCoordinate(index as Logical);
        }
        const y = p.handles!.candleSeries.priceToCoordinate(a.price);
        return x === null || y === null ? null : { x, y };
      };
      if (!p.hidden) for (const row of [...p.rows.filter(row => row.id !== draft.current?.id), ...(draft.current ? [draft.current] : [])].filter(row => !row.hidden)) {
        const points = row.points.map(project);
        if (points.some(point => point === null)) continue;
        const pts = points as Point[];
        const a = pts[0], b = pts[pts.length - 1] ?? a;
        const path = new Path2D();
        const line = (x1: number, y1: number, x2: number, y2: number) => { path.moveTo(x1, y1); path.lineTo(x2, y2); };
        const opacity = row.opacity ?? (row.tool === "highlighter" ? 0.3 : 1);
        const fontSize = row.fontSize ?? 11;
        ctx.strokeStyle = row.color; ctx.fillStyle = row.color; ctx.lineWidth = row.lineWidth ?? (row.tool === "highlighter" ? 10 : 2); ctx.globalAlpha = opacity;
        ctx.setLineDash(row.lineStyle === "dashed" ? [8, 5] : row.lineStyle === "dotted" ? [2, 4] : []);
        ctx.font = `${fontSize}px Arial`;
        const label = (value: string, x = b.x + 6, y = b.y - 6) => { ctx.fillStyle = "#121319"; ctx.fillRect(x - 3, y - fontSize - 1, ctx.measureText(value).width + 6, fontSize + 6); ctx.fillStyle = row.color; ctx.fillText(value, x, y); };
        switch (row.tool) {
          case "horizontal-line": line(0, a.y, w, a.y); label(row.points[0].price.toFixed(2), 8, a.y - 6); break;
          case "vertical-line": line(a.x, 0, a.x, h); break;
          case "horizontal-ray": line(a.x, a.y, w, a.y); break;
          case "extended-line": case "ray": {
            const dx = b.x - a.x, dy = b.y - a.y;
            const start = row.tool === "ray" ? 0 : -10000;
            if (Math.abs(dx) < 0.01) line(a.x, row.tool === "ray" ? a.y : 0, a.x, h);
            else line(a.x + dx * start, a.y + dy * start, a.x + dx * 10000, a.y + dy * 10000); break;
          }
          case "rectangle": case "gann-box": case "measure": case "price-range": case "date-range": {
            path.rect(a.x, a.y, b.x - a.x, b.y - a.y);
            ctx.fillStyle = row.fillColor ?? row.color; ctx.globalAlpha = (row.fillOpacity ?? 0.09) * opacity; ctx.fill(path); ctx.fillStyle = row.color; ctx.globalAlpha = opacity;
            if (row.tool === "gann-box") { line(a.x, a.y, b.x, b.y); line(a.x, b.y, b.x, a.y); line((a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y); line(a.x, (a.y + b.y) / 2, b.x, (a.y + b.y) / 2); }
            if (["measure", "price-range", "date-range"].includes(row.tool)) {
              const m = measurement(row.points[0], row.points[row.points.length - 1]);
              label(`${row.tool !== "date-range" ? `${m.delta.toFixed(2)} (${m.percent.toFixed(2)}%)` : ""}${row.tool !== "price-range" ? ` · ${(m.seconds / 3600).toFixed(1)} sa` : ""}`);
            } break;
          }
          case "ellipse": path.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(1, Math.abs(b.x - a.x) / 2), Math.max(1, Math.abs(b.y - a.y) / 2), 0, 0, Math.PI * 2); ctx.fillStyle = row.fillColor ?? row.color; ctx.globalAlpha = (row.fillOpacity ?? 0.09) * opacity; ctx.fill(path); ctx.globalAlpha = opacity; break;
          case "fibonacci": case "fib-extension": {
            for (const level of row.tool === "fibonacci" ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] : [0, 1, 1.272, 1.618, 2.618]) {
              const y = a.y + (b.y - a.y) * level;
              line(a.x, y, b.x, y); label(`${level} · ${(row.points[0].price + (row.points[row.points.length - 1].price - row.points[0].price) * level).toFixed(2)}`, Math.max(a.x, b.x) + 5, y - 3);
            } break;
          }
          case "fib-time": for (const n of [0, 1, 2, 3, 5, 8, 13]) { const x = a.x + (b.x - a.x) * n; line(x, 0, x, h); label(String(n), x + 3, 16); } break;
          case "fib-fan": case "gann-fan": for (const n of row.tool === "fib-fan" ? [0.382, 0.5, 0.618, 1] : [0.25, 0.5, 1, 2, 4]) { line(a.x, a.y, a.x + (b.x - a.x) * 100, a.y + (b.y - a.y) * n * 100); } break;
          case "text": case "callout": case "price-label": {
            const value = row.tool === "price-label" ? row.points[0].price.toFixed(2) : row.text;
            const lines = value.split("\n");
            lines.forEach((line, index) => label(line, a.x + 8, a.y - 8 + index * (fontSize + 5)));
            path.rect(a.x + 4, a.y - fontSize - 12, Math.max(...lines.map(line => ctx.measureText(line).width), 4) + 8, lines.length * (fontSize + 5) + 5);
            if (row.tool === "callout") line(a.x, a.y, a.x + 8, a.y - 8); break;
          }
          case "brush": case "highlighter": pts.forEach((point, index) => index ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y)); break;
          default:
            line(a.x, a.y, b.x, b.y);
            if (row.tool === "channel") { const offset = (b.y - a.y) * 0.5; line(a.x, a.y + offset, b.x, b.y + offset); ctx.setLineDash([4, 4]); line(a.x, a.y + offset / 2, b.x, b.y + offset / 2); }
            if (row.tool === "arrow") { const angle = Math.atan2(b.y - a.y, b.x - a.x); line(b.x, b.y, b.x - 12 * Math.cos(angle - 0.45), b.y - 12 * Math.sin(angle - 0.45)); line(b.x, b.y, b.x - 12 * Math.cos(angle + 0.45), b.y - 12 * Math.sin(angle + 0.45)); }
            if (row.tool === "info-line") { const m = measurement(row.points[0], row.points[row.points.length - 1]); label(`${m.delta.toFixed(2)} · ${m.percent.toFixed(2)}%`); }
        }
        ctx.stroke(path); ctx.setLineDash([]); ctx.globalAlpha = 1;
        paths.current.push({ id: row.id, path, points: pts });
        if (selected.current === row.id) for (const point of [a, b]) { ctx.fillStyle = row.locked ? "#f5bd4f" : "#ffffff"; ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input,textarea,select,[contenteditable=true]")) return;
      if (event.key === "Escape") { draft.current = null; drag.current = null; pick(null); latest.current.onTool("cursor"); }
      const active = document.activeElement;
      if (!canvas.current?.parentElement?.closest("section")?.contains(active) && active !== document.body) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selected.current && !latest.current.rows.find(row => row.id === selected.current)?.locked) { event.preventDefault(); latest.current.onCommit(latest.current.rows.filter(row => row.id !== selected.current)); pick(null); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const drawing = !["cursor", "crosshair", "eraser", "edit"].includes(props.tool);
  const hit = (x: number, y: number) => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return null;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = 12;
    const result = [...paths.current].reverse().find(row => ctx.isPointInStroke(row.path, x, y) || (["rectangle", "ellipse", "gann-box", "text", "callout", "price-label", "measure", "price-range", "date-range"].includes(latest.current.rows.find(item => item.id === row.id)?.tool ?? "") && ctx.isPointInPath(row.path, x, y)) || row.points.some(point => Math.hypot(point.x - x, point.y - y) < 9));
    ctx.restore(); return result;
  };
  useEffect(() => {
    const parent = canvas.current?.parentElement;
    if (!parent) return;
    const select = (event: PointerEvent) => {
      const p = latest.current;
      if (p.hidden || !p.ready || !["cursor", "crosshair"].includes(p.tool) || event.button !== 0 || !(event.target instanceof HTMLCanvasElement)) return;
      const rect = canvas.current!.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      const found = hit(x, y);
      if (!found) { pick(null); return; }
      event.preventDefault(); event.stopPropagation();
      canvas.current?.focus({ preventScroll: true }); pick(found.id); p.onTool("edit");
    };
    const context = (event: MouseEvent) => {
      const p = latest.current;
      if (p.hidden || !p.ready || !(event.target instanceof HTMLCanvasElement)) return;
      const rect = canvas.current!.getBoundingClientRect();
      const found = hit(event.clientX - rect.left, event.clientY - rect.top);
      if (!found) return;
      event.preventDefault(); event.stopPropagation();
      canvas.current?.focus({ preventScroll: true }); pick(found.id); p.onTool("edit");
    };
    parent.addEventListener("pointerdown", select, true);
    parent.addEventListener("contextmenu", context, true);
    return () => { parent.removeEventListener("pointerdown", select, true); parent.removeEventListener("contextmenu", context, true); };
  }, []);
  const selectedRow = props.rows.find(row => row.id === selection);
  const update = (patch: Partial<Drawing>) => props.onCommit(props.rows.map(row => row.id === selection ? { ...row, ...patch } : row));
  return <>
    <canvas ref={canvas} tabIndex={-1} aria-label="Grafik çizim alanı" data-testid="drawing-canvas" className="absolute left-0 top-0 z-10 touch-none outline-none" style={{ pointerEvents: props.hidden || !props.ready || (!drawing && props.tool !== "edit" && props.tool !== "eraser") ? "none" : "auto", cursor: drawing ? "crosshair" : props.tool === "eraser" ? "not-allowed" : "default" }}
      onPointerDown={event => {
         if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left, y = event.clientY - rect.top;
         const anchor = toAnchor(x, y); if (!anchor) return;
         event.currentTarget.focus({ preventScroll: true });
        if (drawing) {
          if (props.rows.length >= 500) { setMessage("En fazla 500 çizim eklenebilir"); return; }
          event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
          draft.current = { id: crypto.randomUUID(), tool: props.tool as AnnotationTool, points: [anchor], color: props.color, text: text.slice(0, 200) || "Not" }; pick(null);
        } else {
          const found = hit(x, y);
           if (!found) { pick(null); if (props.tool === "edit") props.onTool("cursor"); return; }
          event.stopPropagation();
           if (props.tool === "eraser") { if (!props.rows.find(row => row.id === found.id)?.locked) props.onCommit(props.rows.filter(row => row.id !== found.id)); pick(null); return; }
           const row = props.rows.find(row => row.id === found.id); if (!row) return;
           pick(row.id); if (row.locked) return;
          const handle = found.points.findIndex(point => Math.hypot(point.x - x, point.y - y) < 9);
          drag.current = { id: row.id, handle, start: anchor, original: row }; pick(row.id); event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={event => {
        if (!draft.current && !drag.current) return;
        const rect = event.currentTarget.getBoundingClientRect(); const anchor = toAnchor(event.clientX - rect.left, event.clientY - rect.top); if (!anchor) return;
        if (drag.current) {
          const d = drag.current;
          draft.current = { ...d.original, points: d.original.points.map((point, index) => d.handle >= 0 ? index === d.handle ? anchor : point : ({ time: point.time + anchor.time - d.start.time, price: point.price + anchor.price - d.start.price })) };
        } else if (draft.current && !ONE_POINT_TOOLS.includes(draft.current.tool)) {
          const row = draft.current;
          row.points = ["brush", "highlighter"].includes(row.tool) ? [...row.points.slice(0, 1999), anchor] : [row.points[0], anchor];
        }
      }}
      onPointerUp={event => {
        const row = draft.current;
        if (row && (ONE_POINT_TOOLS.includes(row.tool) || row.points.length > 1)) { props.onCommit([...props.rows.filter(item => item.id !== row.id), row]); pick(row.id); setMessage(`${TOOL_LABELS[row.tool]} eklendi`); }
        draft.current = null; const editing = !!drag.current; drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (drawing && !props.repeat && !editing) props.onTool("cursor");
      }} onPointerCancel={() => { draft.current = null; drag.current = null; }}
    />
    {drawing ? <div className="pointer-events-none absolute left-3 top-12 z-20 rounded bg-terminal-elevated/90 px-2 py-1 text-[10px] text-terminal-muted">{TOOL_LABELS[props.tool]} · {ONE_POINT_TOOLS.includes(props.tool) ? "Yerleştirmek için tıkla" : "Çizmek için sürükle"} · Esc: iptal</div> : null}
    {["text", "callout"].includes(props.tool) ? <input aria-label="Çizim metni" value={text} maxLength={200} onChange={event => setText(event.target.value)} className="absolute left-3 top-20 z-20 w-44 rounded border border-terminal-border bg-terminal-elevated p-2 text-xs"/> : null}
    <button aria-expanded={objectsOpen} onClick={() => setObjectsOpen(!objectsOpen)} className="absolute left-3 top-1 z-20 rounded border border-terminal-border bg-terminal-elevated px-2 py-1 text-[10px]">Çizim nesneleri ({props.rows.length})</button>
    {objectsOpen ? <div role="region" aria-label="Çizim nesneleri" className="absolute left-3 top-9 z-30 max-h-[60%] w-52 overflow-auto rounded border border-terminal-border bg-terminal-elevated p-2 text-[11px]">{props.rows.length ? props.rows.map((row, index) => <button key={row.id} aria-pressed={selection === row.id} onClick={() => { pick(row.id); props.onTool("edit"); setObjectsOpen(false); }} className="block w-full truncate rounded p-2 text-left hover:bg-terminal-hover">{index + 1}. {TOOL_LABELS[row.tool]} {row.locked ? "🔒" : ""} {row.hidden ? "(gizli)" : ""}</button>) : "Henüz çizim yok"}</div> : null}
    {selectedRow && !props.hidden ? <DrawingProperties key={selectedRow.id} row={selectedRow} onChange={update} onDelete={() => { props.onCommit(props.rows.filter(row => row.id !== selection)); pick(null); }} onDuplicate={() => {
      if (props.rows.length >= 500) return;
      const copy = { ...selectedRow, id: crypto.randomUUID(), locked: false, hidden: false, points: selectedRow.points.map(point => ({ ...point, time: point.time + props.intervalSeconds * 2 })) };
      props.onCommit([...props.rows, copy]); pick(copy.id);
    }} onLayer={front => { const others = props.rows.filter(row => row.id !== selection); props.onCommit(front ? [...others, selectedRow] : [selectedRow, ...others]); }} onClose={() => { pick(null); props.onTool("cursor"); }}/>: null}
    <span role="status" className="sr-only">{message} · {props.rows.length} çizim</span>
  </>;
}
