import { activeMiners, pools } from "@/lib/active";
import { listAgents } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const [miners, p, all] = await Promise.all([activeMiners(), pools(), listAgents()]);
  const hashrate = new Map<string, bigint>();
  for (const m of miners) hashrate.set(m.asset, (hashrate.get(m.asset) ?? 0n) + m.hashrate);
  return Response.json(
    {
      deployed: all.length,
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
