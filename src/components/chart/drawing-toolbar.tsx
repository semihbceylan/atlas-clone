"use client";

import { useRef, useState } from "react";
import { MousePointer2, ChevronRight, Spline, RectangleHorizontal, AlignJustify, Ruler, Type, Magnet, EyeOff, Trash2, Star, PencilLine, Undo2, Redo2, Eraser } from "lucide-react";
import { IconButton } from "@/components/terminal/icon-button";
import { DRAWING_GROUPS, TOOL_LABELS, type ChartTool } from "@/lib/chart/drawings";
import { useClickOutside } from "@/hooks/use-click-outside";

interface Props {
  activeTool: ChartTool; onSelectTool: (tool: ChartTool) => void;
  magnet: boolean; onMagnet: () => void; hidden: boolean; onHidden: () => void;
  repeat: boolean; onRepeat: () => void; count: number; onClear: () => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  color: string; onColor: (color: string) => void;
}
const icons = [Spline, RectangleHorizontal, AlignJustify, Ruler, Type];
export function DrawingToolbar(props: Props) {
  const [group, setGroup] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<string[]>(["trend-line", "horizontal-line", "fibonacci"]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [groupTools, setGroupTools] = useState<ChartTool[]>(DRAWING_GROUPS.map(item => item.tools[0][0]));
  const root = useRef<HTMLDivElement>(null);
  useClickOutside(root, group !== null, () => setGroup(null));
  return <div ref={root} className="drawing-rail absolute inset-y-0 left-0 z-20 w-11 border-r border-terminal-border">
    <div role="toolbar" aria-label="Çizim araçları" aria-orientation="vertical" className="drawing-rail-scroll flex h-full flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden pb-3 pt-2">
      {DRAWING_GROUPS.map((item, index) => {
        const Icon = icons[index];
        return <div key={item.label} className="group relative flex h-6 w-full shrink-0 items-center justify-center">
          <button type="button" title={`${item.label} · ${TOOL_LABELS[groupTools[index]]}`} aria-label={item.label} aria-pressed={item.tools.some(([id]) => id === props.activeTool)} onClick={() => props.onSelectTool(props.activeTool === groupTools[index] ? "cursor" : groupTools[index])} className="drawing-rail-button">
            {index === 0 ? <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden="true"><path d="m4 12 8-8" stroke="currentColor" strokeWidth="1.4"/><circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.4"/></svg> : <Icon className="size-4"/>}
          </button>
          <button type="button" aria-label={`${item.label} seçenekleri`} aria-expanded={group === index} aria-haspopup="dialog" onClick={() => setGroup(group === index ? null : index)} className="absolute inset-y-0 right-0 flex w-2 items-center justify-center rounded-sm opacity-0 hover:bg-terminal-hover focus-visible:opacity-100 group-hover:opacity-100" ><ChevronRight className="size-2"/></button>
        </div>;
      })}
      <span className="h-px w-full shrink-0 bg-terminal-border"/>
      <IconButton label="Çizim modu" active={props.repeat} icon={<PencilLine className="size-4"/>} onClick={props.onRepeat}/>
      <IconButton label="Mıknatıs modu" active={props.magnet} icon={<Magnet className="size-4"/>} onClick={props.onMagnet}/>
      <IconButton label={props.hidden ? "Çizimleri göster" : "Çizimleri gizle"} active={props.hidden} icon={<EyeOff className="size-4"/>} onClick={props.onHidden}/>
      <span className="h-px w-full shrink-0 bg-terminal-border"/>
      <IconButton label="Çizimleri temizle" disabled={!props.count} icon={<Trash2 className="size-4"/>} onClick={props.onClear}/>
      <span className="h-px w-full shrink-0 bg-terminal-border"/>
      <IconButton label="Favorileri göster" active={showFavorites} icon={<Star className="size-4"/>} onClick={() => setShowFavorites(!showFavorites)}/>
    </div>
    <div role="toolbar" aria-label="Çizim düzenleme" className="drawing-edit-bar absolute bottom-2 left-12 flex items-center gap-1 rounded border border-terminal-border bg-terminal-elevated/95 p-1 shadow-lg">
      <IconButton label="İmleç" size="sm" icon={<MousePointer2 className="size-3.5"/>} active={props.activeTool === "cursor"} onClick={() => props.onSelectTool("cursor")}/>
      <IconButton label="Çizimleri düzenle" size="sm" icon={<PencilLine className="size-3.5"/>} active={props.activeTool === "edit"} onClick={() => props.onSelectTool("edit")}/>
      <IconButton label="Silgi" size="sm" active={props.activeTool === "eraser"} icon={<Eraser className="size-3.5"/>} onClick={() => props.onSelectTool("eraser")}/>
      <IconButton label="Çizimi geri al" size="sm" disabled={!props.canUndo} icon={<Undo2 className="size-3.5"/>} onClick={props.onUndo}/>
      <IconButton label="Çizimi yinele" size="sm" disabled={!props.canRedo} icon={<Redo2 className="size-3.5"/>} onClick={props.onRedo}/>
      <input type="color" aria-label="Çizim rengi" value={props.color} onChange={event => props.onColor(event.target.value)} className="h-5 w-5 shrink-0 cursor-pointer bg-transparent"/>
    </div>
    {group !== null ? <div role="dialog" aria-label={DRAWING_GROUPS[group].label} style={{ top: `${8 + group * 30}px` }} className="absolute left-11 z-30 max-h-[min(380px,65vh)] w-56 overflow-y-auto rounded-md border border-terminal-border-strong bg-terminal-elevated p-2 shadow-xl"><p className="p-2 text-xs text-terminal-muted">{DRAWING_GROUPS[group].label}</p>{DRAWING_GROUPS[group].tools.map(([id, label]) => <div key={id} className="flex items-center"><button onClick={() => { props.onSelectTool(id); setGroupTools(current => current.map((tool, index) => index === group ? id : tool)); setGroup(null); }} className={`flex-1 rounded p-2 text-left text-xs hover:bg-terminal-hover ${props.activeTool === id ? "text-terminal-accent-soft" : ""}`}>{label}</button><button aria-label={`${label} favori`} aria-pressed={favorites.includes(id)} onClick={() => setFavorites(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])} className="p-2 text-terminal-muted"><Star className={`size-3 ${favorites.includes(id) ? "fill-terminal-accent text-terminal-accent" : ""}`}/></button></div>)}</div> : null}
    {showFavorites ? <div role="toolbar" aria-label="Favori çizimler" className="absolute left-12 top-1 flex max-w-[60vw] gap-1 overflow-x-auto rounded border border-terminal-border bg-terminal-elevated p-1 shadow-lg">{favorites.map(id => <button key={id} onClick={() => props.onSelectTool(id as ChartTool)} className="shrink-0 rounded px-2 py-1 text-[10px] hover:bg-terminal-hover">{TOOL_LABELS[id]}</button>)}</div> : null}
  </div>;
}
