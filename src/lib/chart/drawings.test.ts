import { describe, expect, it } from "vitest";
import { measurement, validateDrawings } from "./drawings";

describe("local drawing data", () => {
  const drawing = { id: "a", tool: "trend-line", text: "", color: "#9292ff", points: [{ time: 100, price: 50 }, { time: 200, price: 60 }] };
  it("restores valid anchors and rejects corrupt tools, coordinates and colors", () => {
    expect(validateDrawings([drawing, { ...drawing, tool: "unknown" }, { ...drawing, color: "invalid" }, { ...drawing, points: [{ time: NaN, price: 10 }] }])).toEqual([drawing]);
    expect(validateDrawings(null)).toEqual([]);
  });
  it("calculates price and time measurements, including zero prices", () => {
    expect(measurement(drawing.points[0], drawing.points[1])).toEqual({ delta: 10, percent: 20, seconds: 100 });
    expect(measurement({ time: 200, price: 0 }, { time: 100, price: 10 }).percent).toBe(0);
  });
  it("restores appearance and object state while retaining legacy drawings", () => {
    const styled = { ...drawing, lineWidth: 4, lineStyle: "dashed", opacity: 0.5, fillColor: "#00ff00", fillOpacity: 0.2, fontSize: 16, hidden: true, locked: true };
    expect(validateDrawings([drawing, styled])).toEqual([drawing, styled]);
  });
  it("rejects invalid saved drawing properties", () => {
    for (const patch of [{ lineWidth: 0 }, { lineWidth: Infinity }, { lineStyle: "bad" }, { opacity: 2 }, { fillOpacity: -1 }, { fillColor: "red" }, { fontSize: 99 }, { locked: "yes" }, { hidden: 1 }]) expect(validateDrawings([{ ...drawing, ...patch }])).toEqual([]);
  });
});
