import { describe, it, expect } from "vitest";
import { amenityWindows, amenityMinimumMinutes } from "./amenity-guidelines";
describe("Excel amenity restrictions", () => {
  it("removes Sunday Mass time while preserving each facility's earlier closing", () => {
    expect(amenityWindows("Function hall", "2026-11-29")).toEqual([
      [480, 630],
      [780, 1320],
    ]);
    expect(amenityWindows("Basketball court", "2026-11-29")).toEqual([
      [420, 630],
    ]);
    expect(amenityWindows("Swimming pool", "2026-11-29")).toEqual([[420, 630]]);
  });
  it("keeps pool closed Monday and sets the court/hall minimums", () => {
    expect(amenityWindows("Swimming pool", "2026-11-30")).toEqual([]);
    expect(amenityMinimumMinutes("Basketball court")).toBe(60);
    expect(amenityMinimumMinutes("Function hall")).toBe(120);
  });
});
