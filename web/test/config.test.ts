import { describe, expect, it } from "vitest";
import { ASSETS, TIERS } from "../lib/config";

describe("tiers", () => {
  it("never pay less per token as the tier rises, so splitting a balance cannot win", () => {
    for (let i = 1; i < TIERS.length; i++) {
      const lo = TIERS[i - 1];
      const hi = TIERS[i];
      expect(hi.minHold).toBeGreaterThan(lo.minHold);
      // hi.hashrate / hi.minHold >= lo.hashrate / lo.minHold
      expect(hi.hashrate * lo.minHold).toBeGreaterThanOrEqual(lo.hashrate * hi.minHold);
    }
  });

  it("lists every asset once", () => {
    const addrs = ASSETS.map((a) => a.address.toLowerCase());
    expect(new Set(addrs).size).toBe(addrs.length);
  });
});
