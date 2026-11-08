import { createPublicKey, randomInt, verify } from "node:crypto";
import { isFresh } from "./auth";
import { getNodeTs, setNodeTs } from "./kv";

// A rig's terminal holds an Ed25519 key. Its id is the raw 32-byte public key, base64url.
// The key holds no funds and can claim nothing: it only proves "this terminal is running".

/** How often the terminal sends a heartbeat, and how long one keeps the rig mining. */
export const BEAT_SECONDS = 5 * 60;
// Overridable only so fork tests, which jump chain time by hours, can keep a rig "on" across the jump.
export const BEAT_WINDOW = Number(process.env.RIG_BEAT_WINDOW ?? 10 * 60);
export const PAIR_TTL = 30 * 60;

const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");

export const validNodeId = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9_-]{43}$/.test(id) && Buffer.from(id, "base64url").length === 32;

export const nodeMessage = (kind: "node" | "beat", node: string, ts: number) => `ultravein ${kind}\nnode: ${node}\nts: ${ts}`;

/** Ed25519 signature by `node` over `message`. */
export function nodeSigned(node: string, message: string, sig: unknown) {
  if (typeof sig !== "string") return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(node, "base64url")]), format: "der", type: "spki" });
    return verify(null, Buffer.from(message), key, Buffer.from(sig, "base64url"));
  } catch {
    return false;
  }
}

/** Signature check plus freshness; burns the timestamp so a heartbeat cannot be replayed. */
export async function verifyNode(kind: "node" | "beat", node: string, ts: unknown, sig: unknown): Promise<string | null> {
  if (!validNodeId(node) || typeof ts !== "number") return "bad request";
  if (!isFresh(ts, await getNodeTs(node), Math.floor(Date.now() / 1000))) return "clock skew or replay: check your system time";
  if (!nodeSigned(node, nodeMessage(kind, node, ts), sig)) return "bad node signature";
  await setNodeTs(node, ts);
  return null;
}

// No 0/O/1/I, so a code read off a terminal is typed back right.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const pairCode = () =>
  "UV-" + Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
export const validCode = (c: unknown): c is string => typeof c === "string" && /^UV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c);
