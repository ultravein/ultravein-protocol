import { activeMiners, pools } from "@/lib/active";
import { listAgents } from "@/lib/kv";
import { shop } from "@/lib/chain";
import { TIERS } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const [miners, p, all, s] = await Promise.all([activeMiners(), pools(), listAgents(), shop(TIERS.length).catch(() => null)]);
  const hashrate = new Map<string, bigint>();
  for (const m of miners) hashrate.set(m.asset, (hashrate.get(m.asset) ?? 0n) + m.hashrate);
  return Response.json(
    {
      deployed: all.length,
      // VGA shop: price per tier in the shop token, "0" while that tier is not for sale
      shop: { token: s?.token ?? null, prices: TIERS.map((_, i) => (s?.prices[i] ?? 0n).toString()) },
      pools: p.map((x) => ({
        ...x,
        balance: x.balance.toString(),
        committed: x.committed.toString(),
        claimed: x.claimed.toString(),
        emissionPerHour: x.emissionPerHour.toString(),
        hashrate: (hashrate.get(x.address) ?? 0n).toString(),
      })),
      agents: miners
        .sort((a, b) => (b.hashrate > a.hashrate ? 1 : b.hashrate < a.hashrate ? -1 : 0))
        .slice(0, 50)
        .map((m) => ({ ...m, hashrate: m.hashrate.toString() })),
    },
    { headers: { "cache-control": "public, s-maxage=30" } }
  );
}
