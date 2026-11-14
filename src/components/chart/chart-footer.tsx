"use client";

import { CandlestickChart, Crosshair, Maximize2 } from "lucide-react";
import { TIMEFRAMES, type FeedStatus, type Timeframe } from "@/types/market";
import { TIMEFRAME_LABELS } from "@/components/chart/chart-header";
import { IconButton } from "@/components/terminal/icon-button";

interface ChartFooterProps {
  status: FeedStatus;
  crosshairSnapped: boolean;
  onToggleSnap: () => void;
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  /** `true` when the crosshair is currently over the canvas. */
  isHovering: boolean;
}

interface LegendItem {
  label: string;
  className: string;
}

const LEGEND: readonly LegendItem[] = [
  { label: "Mum", className: "bg-terminal-accent" },
  { label: "Hacim", className: "bg-terminal-muted" },
  { label: "Son fiyat", className: "bg-terminal-accent-soft" },
];

/**
 * Bottom toolbar: interval selection on the left, an active-series legend in the
 * middle and chart utilities on the right.
 *
 * Budak zaman aralığı değişimi Redux'a yazılır — bu düşük frekanslı bir kullanıcı
 * tercihi olduğu için global state'e uygun, tik verisi ise değildir.
 */
export function ChartFooter({ crosshairSnapped, onToggleSnap, status, timeframe, onTimeframeChange, isHovering }: ChartFooterProps) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-t border-terminal-border bg-terminal-panel px-2">
      <div role="group" aria-label="Zaman aralığı" className="flex items-center gap-0.5">
        {TIMEFRAMES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === timeframe}
            onClick={() => onTimeframeChange(option)}
            className={`h-5.5 rounded px-1.5 text-[10.5px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-terminal-accent/40 focus-visible:outline-none ${
              option === timeframe
                ? "bg-terminal-accent/15 text-terminal-accent-soft"
                : "text-terminal-muted hover:bg-terminal-hover hover:text-terminal-text"
            }`}
          >
            {TIMEFRAME_LABELS[option]}
          </button>
        ))}
      </div>

      <span className="h-3.5 w-px bg-terminal-border" />

      <div className="hidden items-center gap-2.5 md:flex">
        {LEGEND.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <span aria-hidden className={`size-1.5 rounded-full ${item.className}`} />
            <span className="text-[10px] text-terminal-muted">{item.label}</span>
          </span>
        ))}
      </div>

      <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-terminal-muted">
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${
            status === "live" ? "bg-terminal-up" : status === "simulation" ? "bg-terminal-muted" : "bg-terminal-down"
          }`}
        />
        {status === "live" ? "Coinbase · Canlı" : status === "simulation" ? "Simüle veri" : status === "reconnecting" ? "Yeniden bağlanıyor" : status === "error" ? "Bağlantı hatası" : "Bağlanıyor…"}
        {isHovering ? <span className="sr-only">İmleç verisi</span> : null}
      </span>

      <div className="hidden items-center gap-0.5 sm:flex">
        <IconButton label="Nişangâhı kilitle" icon={<Crosshair className="size-3.5" />} size="sm" active={crosshairSnapped} onClick={onToggleSnap} />
        <span title="Mum grafiği" className="px-1 text-terminal-muted"><CandlestickChart className="size-3.5" /></span>
        <IconButton label="Tam ekran" icon={<Maximize2 className="size-3.5" />} size="sm" onClick={event => {
          const panel = event.currentTarget.closest("section");
          const action = document.fullscreenElement ? document.exitFullscreen() : panel?.requestFullscreen();
          void action?.catch(() => {});
        }} />
      </div>
    </div>
  );
}
