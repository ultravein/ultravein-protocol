export type SignedAction =
  | { action: "agent"; address: string; name: string; tier: string; asset: string; avatar: string; ts: number }
  | { action: "session"; address: string; ts: number };

export const MAX_SKEW_SECONDS = 300;

/** The exact text a wallet signs. Every field is in it, so none can be swapped after signing. */
export function messageFor(a: SignedAction): string {
  const lines = [`ultravein ${a.action}`, `address: ${a.address.toLowerCase()}`];
  if (a.action === "agent") lines.push(`name: ${a.name}`, `tier: ${a.tier}`, `asset: ${a.asset}`, `avatar: ${a.avatar}`);
  lines.push(`ts: ${a.ts}`);
  return lines.join("\n");
}

/** Within MAX_SKEW of now and newer than the wallet's last accepted timestamp. */
export function isFresh(ts: number, lastTs: number | null, now: number) {
  return Number.isInteger(ts) && Math.abs(now - ts) <= MAX_SKEW_SECONDS && (lastTs === null || ts > lastTs);
}

export function validName(name: string) {
  const bytes = new TextEncoder().encode(name).length;
  return bytes >= 1 && bytes <= 32 && name === name.trim() && !/[\u0000-\u001f]/.test(name);
}
