import { isAddress } from "viem";
import { isFresh, messageFor, type SignedAction } from "./auth";
import { publicClient } from "./chain";
import { getLastTs, setLastTs } from "./kv";

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Checks the signature (EOA or contract wallet) and burns the timestamp. Returns an error text or null. */
export async function verifySigned(action: SignedAction, signature: unknown): Promise<string | null> {
  if (!isAddress(action.address) || typeof signature !== "string" || !signature.startsWith("0x")) return "bad request";
  const now = Math.floor(Date.now() / 1000);
  if (!isFresh(action.ts, await getLastTs(action.address), now)) return "signature expired, sign again";
  const ok = await publicClient
    .verifyMessage({ address: action.address, message: messageFor(action), signature: signature as `0x${string}` })
    .catch(() => false);
  if (!ok) return "signature does not match this wallet";
  await setLastTs(action.address, action.ts);
  return null;
}
