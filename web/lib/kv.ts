import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Redis } from "@upstash/redis";
import type { AvatarId, TierId } from "./config";

// avatar is optional: agents saved before characters existed have none
export type Agent = { name: string; tier: TierId; asset: string; createdAt: number; avatar?: AvatarId };
export type Session = { start: number; end: number; tier: TierId; asset: string };

interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
}

// Local dev without Upstash: one JSON file. Not safe for concurrent writers, which dev doesn't have.
class FileStore implements Store {
  private file = "data/kv.json";
  private load(): Record<string, string | string[]> {
    return existsSync(this.file) ? JSON.parse(readFileSync(this.file, "utf8")) : {};
  }
  private save(d: Record<string, string | string[]>) {
    mkdirSync("data", { recursive: true });
    writeFileSync(this.file, JSON.stringify(d, null, 1));
  }
  async get(k: string) {
    const v = this.load()[k];
    return typeof v === "string" ? v : null;
  }
  async set(k: string, v: string) {
    const d = this.load();
    d[k] = v;
    this.save(d);
  }
  async sadd(k: string, m: string) {
    const d = this.load();
    const s = new Set((d[k] as string[] | undefined) ?? []);
    s.add(m);
    d[k] = [...s];
    this.save(d);
  }
  async smembers(k: string) {
    return (this.load()[k] as string[] | undefined) ?? [];
  }
}

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
// automaticDeserialization off: amounts are decimal strings and must not become lossy numbers.
const store: Store =
  url && token ? (new Redis({ url, token, automaticDeserialization: false }) as unknown as Store) : new FileStore();

const getJson = async <T>(k: string): Promise<T | null> => {
  const v = await store.get(k);
  return v === null ? null : (JSON.parse(v) as T);
};
const setJson = (k: string, v: unknown) => store.set(k, JSON.stringify(v));

export const getAgent = (a: string) => getJson<Agent>(`agent:${a}`);
export const setAgent = async (a: string, agent: Agent) => {
  await setJson(`agent:${a}`, agent);
  await store.sadd("agents", a);
};
export const listAgents = () => store.smembers("agents");
export const getSession = (a: string) => getJson<Session>(`session:${a}`);
export const setSession = (a: string, s: Session) => setJson(`session:${a}`, s);
export const getLastTs = (a: string) => getJson<number>(`lastTs:${a}`);
export const setLastTs = (a: string, ts: number) => setJson(`lastTs:${a}`, ts);

/** Cumulative allocations, keys `${account}:${asset}`. */
export async function getAcc() {
  const raw = (await getJson<Record<string, string>>("acc")) ?? {};
  return new Map(Object.entries(raw).map(([k, v]) => [k, BigInt(v)]));
}
export const setAcc = (acc: Map<string, bigint>) =>
  setJson("acc", Object.fromEntries([...acc].map(([k, v]) => [k, v.toString()])));

export type EpochState = { last: number; block: string };
export const getEpochState = () => getJson<EpochState>("epoch");
export const setEpochState = (s: EpochState) => setJson("epoch", s);

// --- history for the dashboard (bounded JSON arrays; one writer per key in practice) ---

/** One wallet's result for one epoch. amount is in the asset's smallest unit. */
export type HistEntry = { e: number; asset: string; amount: string; tier: string | null; secs: number };
/** The network in one epoch: per asset, effective hashrate, pool left before release, and what was released. */
export type NetEntry = { e: number; agents: number; hashrate: Record<string, string>; pools: Record<string, string>; emitted: Record<string, string> };
export type Act = { ts: number; kind: "agent" | "session"; text: string };

async function pushList<T>(key: string, items: T[], max: number) {
  if (!items.length) return;
  const cur = (await getJson<T[]>(key)) ?? [];
  await setJson(key, [...cur, ...items].slice(-max));
}

export const pushHist = (a: string, items: HistEntry[]) => pushList(`hist:${a}`, items, 720); // 30 days of epochs
export const getHist = async (a: string) => (await getJson<HistEntry[]>(`hist:${a}`)) ?? [];
export const pushNet = (items: NetEntry[]) => pushList("net", items, 720);
export const getNet = async () => (await getJson<NetEntry[]>("net")) ?? [];
export const pushAct = (a: string, item: Act) => pushList(`act:${a}`, [item], 200);
export const getAct = async (a: string) => (await getJson<Act[]>(`act:${a}`)) ?? [];

export const saveTree = (root: string, dump: string) => store.set(`tree:${root}`, dump);
export const getTreeDump = (root: string) => store.get(`tree:${root}`);
