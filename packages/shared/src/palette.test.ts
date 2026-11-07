import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A regression guard for the ordered age ramp, not a substitute for directly
// labelled values or real-user accessibility testing. Simulations use linear
// RGB full-severity matrices; distances are CIE76 in D65 Lab.
const css = readFileSync(
  new URL("../../../apps/web/src/styles/tokens.css", import.meta.url),
  "utf8",
);
const matrices = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
function lab(hex: string, matrix: number[][]) {
  const rgb = hex.match(/[a-f0-9]{2}/gi)!.map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = matrix.map((row) =>
    Math.max(
      0,
      Math.min(
        1,
        row.reduce((sum, v, i) => sum + v * rgb[i], 0),
      ),
    ),
  );
  const xyz = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ];
  const [x, y, z] = xyz.map((value) =>
    value > 216 / 24389 ? Math.cbrt(value) : ((24389 / 27) * value + 16) / 116,
  );
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
describe("ordered chart age palette", () => {
  for (const [theme, block] of [
    ["light", css.split(':root[data-theme="dark"]')[0]],
    ["dark", css.split(':root[data-theme="dark"]')[1]],
  ] as const) {
    for (const [vision, matrix] of Object.entries(matrices)) {
      it(`${theme} ${vision} keeps ages ordered and distinguishable`, () => {
        const values = ["current", "mid", "late", "oldest"].map((name) => {
          const hex = block.match(
            new RegExp(`--chart-aging-${name}:\\s*(#[a-f0-9]{6})`),
          )?.[1];
          expect(hex).toBeDefined();
          return lab(hex!, matrix);
        });
        for (let i = 1; i < values.length; i++) {
          expect(values[i - 1][0] - values[i][0]).toBeGreaterThan(10);
          const delta = Math.hypot(
            ...values[i].map((value, j) => value - values[i - 1][j]),
          );
          expect(delta).toBeGreaterThan(vision === "normal" ? 15 : 10);
        }
      });
    }
  }
});
