import type { Address } from "viem";
import { EMISSION_PPM, TIERS, type Tier } from "./config";

export type Transfer = { block: bigint; logIndex: number; from: Address; to: Address; value: bigint };
export type Weighted = { account: string; asset: string; weight: bigint };

/**
 * Lowest balance `account` held during blocks [start, end], walked back from its
 * balance at the head. `transfers` must include every transfer from `start` to the head.
 */
export function minBalance(account: string, balanceAtHead: bigint, transfers: Transfer[], start: bigint, end: bigint) {
  const me = account.toLowerCase();
  const mine = transfers
    .filter((x) => x.block >= start && (x.from.toLowerCase() === me || x.to.toLowerCase() === me))
    .sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : a.block > b.block ? -1 : 1));
  const undo = (b: bigint, x: Transfer) =>
    b + (x.from.toLowerCase() === me ? x.value : 0n) - (x.to.toLowerCase() === me ? x.value : 0n);

  let b = balanceAtHead;
  let i = 0;
  for (; i < mine.length && mine[i].block > end; i++) b = undo(b, mine[i]);
  let min = b; // balance at the end of the window
  for (; i < mine.length; i++) {
    b = undo(b, mine[i]);
    if (b < min) min = b;
  }
  return min; // includes the balance at the start of the window
}

/**
 * Highest tier the wallet can run, never above the chosen one: a VGA it bought (`owned` is the
 * 1-based tier number from MiningPool.cardOf, 0 = none; bought cards need no holding) or the
 * best one its balance covers.
 */
export function effectiveTier(chosen: Tier, balance: bigint, owned = 0): Tier | undefined {
  let best: Tier | undefined;
  TIERS.forEach((t, i) => {
    if ((i < owned || t.minHold <= balance) && t.hashrate <= chosen.hashrate) best = t;
  });
  return best;
}

export function overlapSeconds(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Splits EMISSION_PPM of each asset's remaining pool between that asset's miners by weight.
 * Rounds down, so the total never exceeds the emission. Keys are `${account}:${asset}`.
 */
export function allocate(miners: Weighted[], remaining: Map<string, bigint>) {
  const totals = new Map<string, bigint>();
  for (const m of miners) totals.set(m.asset, (totals.get(m.asset) ?? 0n) + m.weight);
  const out = new Map<string, bigint>();
  for (const m of miners) {
    const total = totals.get(m.asset) ?? 0n;
    if (m.weight === 0n || total === 0n) continue;
    const emission = ((remaining.get(m.asset) ?? 0n) * EMISSION_PPM) / 1_000_000n;
    const share = (emission * m.weight) / total;
    if (share === 0n) continue;
    const key = `${m.account}:${m.asset}`;
    out.set(key, (out.get(key) ?? 0n) + share);
  }
  return out;
}
