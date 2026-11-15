export const DRAWING_GROUPS = [
  { label: "Çizgiler", tools: [["trend-line", "Trend çizgisi"], ["extended-line", "Uzatılmış çizgi"], ["horizontal-line", "Yatay çizgi"], ["horizontal-ray", "Yatay ışın"], ["ray", "Işın"], ["arrow", "Ok"], ["vertical-line", "Dikey çizgi"], ["info-line", "Bilgi çizgisi"], ["channel", "Trend kanalı"]] },
  { label: "Şekiller", tools: [["rectangle", "Dikdörtgen"], ["ellipse", "Elips"], ["brush", "Serbest çizim"]] },
  { label: "Fibonacci & Gann", tools: [["fibonacci", "Fib Retracement"], ["fib-extension", "Fib Projection"], ["fib-fan", "Fib Rays"], ["fib-time", "Fib Time Zone"], ["gann-box", "Gann Box"], ["gann-fan", "Gann Fan"]] },
  { label: "Ölçüm", tools: [["price-range", "Fiyat Aralığı"], ["date-range", "Tarih Aralığı"], ["measure", "Tarih & Fiyat Aralığı"]] },
  { label: "İşaretler", tools: [["text", "Metin"], ["callout", "Callout"], ["price-label", "Fiyat Etiketi"], ["highlighter", "Highlighter"]] },
] as const;

export type AnnotationTool = typeof DRAWING_GROUPS[number]["tools"][number][0];
export type ChartTool = AnnotationTool | "cursor" | "crosshair" | "eraser" | "edit";
export interface Anchor { time: number; price: number }
export interface Drawing {
  id: string; tool: AnnotationTool; points: Anchor[]; text: string; color: string;
  lineWidth?: number; lineStyle?: "solid" | "dashed" | "dotted";
  opacity?: number; fillColor?: string; fillOpacity?: number;
  fontSize?: number; locked?: boolean; hidden?: boolean;
}
export const TOOL_LABELS: Record<string, string> = Object.fromEntries(DRAWING_GROUPS.flatMap(group => group.tools.map(([id, label]) => [id, label])));
export const ONE_POINT_TOOLS: readonly ChartTool[] = ["horizontal-line", "vertical-line", "text", "callout", "price-label"];
const toolIds = new Set(DRAWING_GROUPS.flatMap(group => group.tools.map(([id]) => id)));
export function validateDrawings(value: unknown): Drawing[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Drawing => {
    if (!row || typeof row !== "object") return false;
    const item = row as Drawing;
    return typeof item.id === "string" && toolIds.has(item.tool) && typeof item.text === "string" && /^#[a-fA-F0-9]{6}$/.test(item.color)
      && Array.isArray(item.points) && item.points.length > 0 && item.points.length <= 2000
      && item.points.every(p => p && Number.isFinite(p.time) && Number.isFinite(p.price))
      && (item.lineWidth === undefined || Number.isFinite(item.lineWidth) && item.lineWidth >= 1 && item.lineWidth <= 10)
      && (item.lineStyle === undefined || ["solid", "dashed", "dotted"].includes(item.lineStyle))
      && (item.opacity === undefined || Number.isFinite(item.opacity) && item.opacity >= 0 && item.opacity <= 1)
      && (item.fillOpacity === undefined || Number.isFinite(item.fillOpacity) && item.fillOpacity >= 0 && item.fillOpacity <= 1)
      && (item.fillColor === undefined || /^#[a-fA-F0-9]{6}$/.test(item.fillColor))
      && (item.fontSize === undefined || Number.isFinite(item.fontSize) && item.fontSize >= 8 && item.fontSize <= 48)
      && (item.locked === undefined || typeof item.locked === "boolean")
      && (item.hidden === undefined || typeof item.hidden === "boolean");
  }).slice(0, 500);
}

export function measurement(a: Anchor, b: Anchor) {
  const delta = b.price - a.price;
  return { delta, percent: a.price ? delta / a.price * 100 : 0, seconds: Math.abs(b.time - a.time) };
}
