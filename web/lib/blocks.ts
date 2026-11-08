/**
 * Last block in [lo, hi] whose timestamp is <= ts. Alternates interpolation and
 * halving: interpolation is fast on evenly spaced blocks, halving bounds the worst case.
 */
export async function blockAtOrBefore(
  ts: number,
  lo: bigint,
  hi: bigint,
  timeOf: (n: bigint) => Promise<number>
): Promise<bigint> {
  let tLo = await timeOf(lo);
  let tHi = await timeOf(hi);
  if (tHi <= ts) return hi;
  if (tLo > ts) throw new Error(`block ${lo} is already past ${ts}`);
  for (let step = 0; hi - lo > 1n; step++) {
    let mid =
      step % 2 === 0
        ? lo + ((hi - lo) * BigInt(ts - tLo)) / BigInt(Math.max(1, tHi - tLo))
        : lo + (hi - lo) / 2n;
    if (mid <= lo) mid = lo + 1n;
    if (mid >= hi) mid = hi - 1n;
    const t = await timeOf(mid);
    if (t <= ts) [lo, tLo] = [mid, t];
    else [hi, tHi] = [mid, t];
  }
  return lo;
}
