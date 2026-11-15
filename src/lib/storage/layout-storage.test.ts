import { describe, expect, it } from "vitest";
import { ALL_WIDGET_IDS, GRID_COLS, GRID_ROWS, WIDGET_MIN_SIZE } from "@/config/default-layout";
import { sanitiseLayout } from "./layout-storage";

describe("module minimum grid sizes", () => {
  for (const id of ALL_WIDGET_IDS) {
    it(`enforces ${id} minimums and bounds when restoring a layout`, () => {
      const result = sanitiseLayout([{ i: id, x: 47, y: 23, w: 1, h: 1, minW: 1, minH: 1 }])!;
      expect(result[0]).toMatchObject({ w: WIDGET_MIN_SIZE[id].minW, h: WIDGET_MIN_SIZE[id].minH, ...WIDGET_MIN_SIZE[id] });
      expect(result[0].x + result[0].w).toBeLessThanOrEqual(GRID_COLS);
      expect(result[0].y + result[0].h).toBeLessThanOrEqual(GRID_ROWS);
    });
  }
});
