import { describe, expect, it } from "vitest";
import { allocate, effectiveTier, minBalance, overlapSeconds, type Transfer } from "../lib/mining";
import { TIERS } from "../lib/config";

const me = "0x00000000000000000000000000000000000000aa" as const;
const other = "0x00000000000000000000000000000000000000bb" as const;
const t = (block: number, from: string, to: string, value: bigint, logIndex = 0): Transfer => ({
  block: BigInt(block),
  logIndex,
  from: from as Transfer["from"],
  to: to as Transfer["to"],
  value,
});

describe("minBalance", () => {
  it("is the head balance when nothing moved", () => {
    expect(minBalance(me, 100n, [], 10n, 20n)).toBe(100n);
  });

  it("sees a dip inside the window even if the wallet bought back", () => {
    // start of window: 100. block 12: sends 90 -> 10. block 15: receives 90 -> 100.
    const xs = [t(12, me, other, 90n), t(15, other, me, 90n)];
    expect(minBalance(me, 100n, xs, 10n, 20n)).toBe(10n);
  });

  it("ignores a buy made after the window", () => {
    // 50 during the window, +1000 at block 25
    expect(minBalance(me, 1050n, [t(25, other, me, 1000n)], 10n, 20n)).toBe(50n);
  });

  it("counts the balance at the start of the window", () => {
    // bought 1000 inside the window at block 15: before that it held 0
    expect(minBalance(me, 1000n, [t(15, other, me, 1000n)], 10n, 20n)).toBe(0n);
  });

  it("orders same-block transfers by log index", () => {
    // block 12: receive 50 (log 1) then send 50 (log 2). Start 0 -> 50 -> 0.
    const xs = [t(12, other, me, 50n, 1), t(12, me, other, 50n, 2)];
    expect(minBalance(me, 0n, xs, 10n, 20n)).toBe(0n);
  });

  it("matches addresses case-insensitively", () => {
    const xs = [t(12, me.toUpperCase().replace("0X", "0x"), other, 90n)];
    expect(minBalance(me, 10n, xs, 10n, 20n)).toBe(10n);
  });
});

describe("effectiveTier", () => {
  it("caps at the chosen tier", () => {
    expect(effectiveTier(TIERS[1], TIERS[3].minHold)?.id).toBe(TIERS[1].id);
  });
  it("drops to the tier the balance covers", () => {
    expect(effectiveTier(TIERS[3], TIERS[1].minHold)?.id).toBe(TIERS[1].id);
  });
  it("is undefined below the lowest tier", () => {
    expect(effectiveTier(TIERS[3], TIERS[0].minHold - 1n)).toBeUndefined();
  });
});

describe("overlapSeconds", () => {
  it("clips to both ranges", () => {
    expect(overlapSeconds(0, 100, 50, 200)).toBe(50);
    expect(overlapSeconds(0, 100, 100, 200)).toBe(0);
  });
});

describe("allocate", () => {
  const eth = "0x0000000000000000000000000000000000000000";
  const nvda = "0x00000000000000000000000000000000000000cc";

  it("splits each asset's emission by weight, never more than the emission", () => {
    const remaining = new Map([[eth, 1_000_000n]]); // emission = 1000
    const out = allocate(
      [
        { account: me, asset: eth, weight: 1n },
        { account: other, asset: eth, weight: 2n },
      ],
      remaining
    );
    expect(out.get(`${me}:${eth}`)).toBe(333n);
    expect(out.get(`${other}:${eth}`)).toBe(666n);
  });

  it("keeps buckets apart and emits nothing without miners", () => {
    const remaining = new Map([
      [eth, 1_000_000n],
      [nvda, 1_000_000n],
    ]);
    const out = allocate([{ account: me, asset: nvda, weight: 5n }], remaining);
    expect(out.get(`${me}:${nvda}`)).toBe(1000n);
    expect([...out.keys()].some((k) => k.endsWith(eth))).toBe(false);
  });

  it("skips zero weights", () => {
    const out = allocate([{ account: me, asset: eth, weight: 0n }], new Map([[eth, 1_000_000n]]));
    expect(out.size).toBe(0);
  });
});
