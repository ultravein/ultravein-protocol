import { formatUnits } from "viem";

/** 18-decimal amount for display, at most 6 decimals. */
export const fmt = (v: string | bigint) => {
  const n = Number(formatUnits(BigInt(v), 18));
  return n === 0 ? "0" : n < 0.000001 ? "<0.000001" : n.toLocaleString("en-US", { maximumFractionDigits: 6 });
};
