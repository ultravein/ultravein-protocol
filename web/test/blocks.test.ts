import { describe, expect, it } from "vitest";
import { blockAtOrBefore } from "../lib/blocks";

// 4 blocks per second: blocks 400..403 share timestamp 100
const chain = () => {
  let calls = 0;
  const timeOf = async (n: bigint) => {
    calls++;
    return Math.floor(Number(n) / 4);
  };
  return { timeOf, calls: () => calls };
};

describe("blockAtOrBefore", () => {
  it("returns the last block at or before the timestamp", async () => {
    const c = chain();
    expect(await blockAtOrBefore(100, 0n, 1_000_000n, c.timeOf)).toBe(403n);
    expect(c.calls()).toBeLessThan(60);
  });

  it("returns hi when the head is not past the timestamp", async () => {
    expect(await blockAtOrBefore(10_000_000, 0n, 1000n, chain().timeOf)).toBe(1000n);
  });

  it("throws when lo is already past the timestamp", async () => {
    await expect(blockAtOrBefore(10, 1000n, 2000n, chain().timeOf)).rejects.toThrow();
  });
});
