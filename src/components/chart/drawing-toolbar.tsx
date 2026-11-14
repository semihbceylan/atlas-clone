"use client";

import {
  Crosshair,
  Eraser,
  Magnet,
  Minus,
  MousePointer2,
  Pen,
  Ruler,
  Square,
  Type,
  TrendingUp,
  AlignStartVertical,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DrawingTool } from "@/store/slices/terminal-slice";
import { IconButton } from "@/components/terminal/icon-button";

interface DrawingToolDefinition {
  id: DrawingTool;
  label: string;
  icon: ReactNode;
}

/**
 * Tool list, split into the two groups shown in the reference terminal: the
 * pointer/selection tools at the top and the annotation tools below them.
 *
 * Only `cursor`, `crosshair` and `magnet` change behaviour in this MVP (they map
 * onto the chart's crosshair mode). The drawing tools are interactive and
 * correctly stateful, but no drawing engine is wired up behind them — see the
 * README's limitations section.
 */
const SELECTION_TOOLS: readonly DrawingToolDefinition[] = [
  { id: "cursor", label: "İmleç", icon: <MousePointer2 className="size-4" /> },
  { id: "crosshair", label: "Nişangâh", icon: <Crosshair className="size-4" /> },
];

const DRAWING_TOOLS: readonly DrawingToolDefinition[] = [
  { id: "trend-line", label: "Trend çizgisi", icon: <Pen className="size-4" /> },
  { id: "horizontal-line", label: "Yatay çizgi", icon: <Minus className="size-4" /> },
  { id: "ray", label: "Işın", icon: <TrendingUp className="size-4" /> },
  { id: "rectangle", label: "Dikdörtgen", icon: <Square className="size-4" /> },
  { id: "fibonacci", label: "Fibonacci düzeltmesi", icon: <AlignStartVertical className="size-4" /> },
  { id: "text", label: "Metin", icon: <Type className="size-4" /> },
  { id: "measure", label: "Ölçüm", icon: <Ruler className="size-4" /> },
  { id: "magnet", label: "Mıknatıs (crosshair hizalaması)", icon: <Magnet className="size-4" /> },
];

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  /** Resets the chart to the pointer tool. */
  onClear: () => void;
}

/**
 * Vertical drawing toolbar pinned to the left edge of the chart canvas.
 *
 * Kept separate from the widget header on purpose: this strip sits *inside* the
 * chart area so it can never be mistaken for the widget's drag handle.
 */
export function DrawingToolbar({ activeTool, onSelectTool, onClear }: DrawingToolbarProps) {
  const renderTool = (tool: DrawingToolDefinition) => (
    <IconButton
      key={tool.id}
      label={tool.label}
      icon={tool.icon}
      active={activeTool === tool.id}
      onClick={() => onSelectTool(tool.id)}
    />
  );

  return (
    <div
      role="toolbar"
      aria-label="Çizim araçları"
      aria-orientation="vertical"
      className="absolute inset-y-0 left-0 z-10 flex w-9 flex-col items-center gap-0.5 border-r border-terminal-border bg-terminal-panel/95 py-1.5 backdrop-blur-sm"
    >
      {SELECTION_TOOLS.map(renderTool)}

      <span className="my-1 h-px w-5 bg-terminal-border" />

      {DRAWING_TOOLS.map(renderTool)}

      <span className="my-1 h-px w-5 bg-terminal-border" />

      <IconButton label="Çizimleri temizle" icon={<Eraser className="size-4" />} onClick={onClear} />
    </div>
  );
}
