import { describe, expect, it } from "vitest";
import { assertPlayerCount } from "../src/index.js";

describe("assertPlayerCount", () => {
  it("accepts every count in the 2–6 range", () => {
    for (const n of [2, 3, 4, 5, 6]) expect(assertPlayerCount(n)).toBe(n);
  });

  it("refuses counts outside the range loudly (no silent clamp)", () => {
    expect(() => assertPlayerCount(1)).toThrow(/got 1/);
    expect(() => assertPlayerCount(7)).toThrow(/got 7/);
  });

  it("refuses non-integers loudly", () => {
    expect(() => assertPlayerCount(2.5)).toThrow(/got 2\.5/);
    expect(() => assertPlayerCount(Number.NaN)).toThrow();
  });
});
