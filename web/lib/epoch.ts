import { zeroHash, type Address } from "viem";
import { ASSETS, CHALLENGE_DELAY, EPOCH_SECONDS, MAX_EPOCHS_PER_RUN, POOL_ADDRESS, TOKEN_ADDRESS, tierById } from "./config";
import { blockAtOrBefore } from "./blocks";
import { blockTime, getTransfers, poolAbi, poolBalance, poolRead, publicClient, publisherClient, tokenBalance } from "./chain";
import {
  getAcc,
  getEpochState,
  getSession,
  listAgents,
  pushHist,
  pushNet,
  saveTree,
  setAcc,
  setEpochState,
  type HistEntry,
  type NetEntry,
  type Session,
} from "./kv";
import { buildTree, totalsByAsset } from "./merkle";
import { allocate, effectiveTier, minBalance, overlapSeconds, type Weighted } from "./mining";

// How far back to search for epoch boundaries on the very first run (~3 days at 4 blocks/s).
const FIRST_RUN_LOOKBACK = 1_000_000n;

/** Processes every finished epoch since the last run (oldest first, capped), then publishes. */
export async function runEpochs({ dry }: { dry: boolean }) {
  const head = await publicClient.getBlock();
  const H = head.number;
  const lastComplete = Math.floor(Number(head.timestamp) / EPOCH_SECONDS) - 1;
  const state = await getEpochState();
  const lastDone = state?.last ?? lastComplete - 1;
  const first = lastDone + 1;
  const last = Math.min(lastComplete, lastDone + MAX_EPOCHS_PER_RUN);

  const acc = await getAcc();
  const added = new Map<string, bigint>();
  const hist = new Map<string, HistEntry[]>();
  const net: NetEntry[] = [];
  let searchFrom = state ? BigInt(state.block) : H > FIRST_RUN_LOOKBACK ? H - FIRST_RUN_LOOKBACK : 0n;

  if (first <= last) {
    // bounds[i] = last block before epoch (first + i) starts; epoch i spans (bounds[i], bounds[i + 1]]
    const bounds: bigint[] = [];
    for (let e = first; e <= last + 1; e++) {
      searchFrom = await blockAtOrBefore(e * EPOCH_SECONDS - 1, searchFrom, H, blockTime);
      bounds.push(searchFrom);
    }

    const rangeStart = first * EPOCH_SECONDS;
    const rangeEnd = (last + 1) * EPOCH_SECONDS;
    const sessions: [string, Session][] = [];
    for (const a of await listAgents()) {
      const s = await getSession(a);
      if (s && overlapSeconds(s.start, s.end, rangeStart, rangeEnd) > 0) sessions.push([a, s]);
    }

    const transfers = await getTransfers(TOKEN_ADDRESS, bounds[0] + 1n, H);
    const balances = new Map<string, bigint>();
    for (const [a] of sessions) balances.set(a, await tokenBalance(TOKEN_ADDRESS, a as Address, H));

    // remaining = pool balance - (everything we allocated - what was already claimed)
    const totals = totalsByAsset(acc);
    const remaining = new Map<string, bigint>();
    for (const { address } of ASSETS) {
      const bal = await poolBalance(address, H);
      const claimed = await poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "claimed", args: [address], blockNumber: H });
      const owed = (totals.get(address) ?? 0n) - claimed;
      remaining.set(address, bal > owed ? bal - owed : 0n);
    }

    for (let i = 0; i <= last - first; i++) {
      const e = first + i;
      const eStart = e * EPOCH_SECONDS;
      const miners: Weighted[] = [];
      const seen: { account: string; asset: string; tier: string | null; secs: number }[] = [];
      const hashrate: Record<string, string> = {};
      for (const [account, s] of sessions) {
        const secs = overlapSeconds(s.start, s.end, eStart, eStart + EPOCH_SECONDS);
        const chosen = tierById(s.tier);
        if (!secs || !chosen) continue;
        const low = minBalance(account, balances.get(account) ?? 0n, transfers, bounds[i] + 1n, bounds[i + 1]);
        const tier = effectiveTier(chosen, low);
        seen.push({ account, asset: s.asset, tier: tier?.id ?? null, secs });
        if (!tier) continue;
        miners.push({ account, asset: s.asset, weight: tier.hashrate * BigInt(secs) });
        hashrate[s.asset] = (BigInt(hashrate[s.asset] ?? "0") + tier.hashrate).toString();
      }
      const pools = Object.fromEntries([...remaining].map(([a, v]) => [a, v.toString()]));
      const emitted: Record<string, string> = {};
      const got = allocate(miners, remaining);
      for (const [key, v] of got) {
        acc.set(key, (acc.get(key) ?? 0n) + v);
        added.set(key, (added.get(key) ?? 0n) + v);
        const asset = key.split(":")[1];
        remaining.set(asset, (remaining.get(asset) ?? 0n) - v);
        emitted[asset] = (BigInt(emitted[asset] ?? "0") + v).toString();
      }
      for (const m of seen) {
        const amount = got.get(`${m.account}:${m.asset}`) ?? 0n;
        const list = hist.get(m.account) ?? [];
        list.push({ e, asset: m.asset, amount: amount.toString(), tier: m.tier, secs: m.secs });
        hist.set(m.account, list);
      }
      net.push({ e, agents: miners.length, hashrate, pools, emitted });
    }
  }

  const summary = {
    epochs: first <= last ? [first, last] : [],
    added: Object.fromEntries([...added].map(([k, v]) => [k, v.toString()])),
  };
  if (dry) return { ...summary, dry: true };

  if (first <= last) {
    await setAcc(acc);
    await setEpochState({ last, block: searchFrom.toString() });
    // history is for the dashboard only; it is written after the allocation it describes
    for (const [account, items] of hist) await pushHist(account, items);
    await pushNet(net);
  }
  return { ...summary, published: await maybePublish(acc, Number(head.timestamp)) };
}

async function maybePublish(acc: Map<string, bigint>, now: number) {
  const tree = buildTree(acc);
  if (!tree) return null;
  const [active, pending] = await Promise.all([
    poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "root" }),
    poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "pendingRoot" }),
  ]);
  const [pendingRoot, publishedAt] = pending;
  if (tree.root === active || tree.root === pendingRoot) return null;
  // the contract refuses a new root while the previous one is still in its challenge delay
  if (pendingRoot !== zeroHash && now < Number(publishedAt) + CHALLENGE_DELAY) return null;

  const totals = [...totalsByAsset(acc)].sort(([a], [b]) => (BigInt(a) < BigInt(b) ? -1 : 1));
  await saveTree(tree.root, JSON.stringify(tree.dump()));
  const wallet = publisherClient();
  const hash = await wallet.writeContract({
    address: POOL_ADDRESS,
    abi: poolAbi,
    functionName: "publish",
    args: [tree.root as `0x${string}`, totals.map(([a]) => a as Address), totals.map(([, v]) => v)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { root: tree.root, hash };
}
