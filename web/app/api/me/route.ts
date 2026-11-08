import { isAddress, zeroAddress, type Address } from "viem";
import { ASSETS, TIERS, TOKEN_ADDRESS, tierById } from "@/lib/config";
import { activeMiners, pools } from "@/lib/active";
import { ownedTier, publicClient, tokenBalance } from "@/lib/chain";
import { getAcc, getAgent, getSession } from "@/lib/kv";
import { effectiveTier } from "@/lib/mining";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(raw)) return Response.json({ error: "bad address" }, { status: 400 });
  const address = raw.toLowerCase() as Address;

  const [agent, session, balance, owned, acc, wallet] = await Promise.all([
    getAgent(address),
    getSession(address),
    tokenBalance(TOKEN_ADDRESS, address),
    ownedTier(address).catch(() => 0),
    getAcc(),
    // what the wallet holds of each reward asset, for the portfolio view
    Promise.all(
      ASSETS.map((a) =>
        (a.address === zeroAddress ? publicClient.getBalance({ address }) : tokenBalance(a.address, address)).catch(() => 0n)
      )
    ),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const running = session && session.end > now ? session : null;
  const chosen = tierById(running?.tier ?? agent?.tier);
  const effective = chosen ? effectiveTier(chosen, balance, owned) : undefined;

  let perHour = "0";
  if (running && effective) {
    const [miners, p] = await Promise.all([activeMiners(now), pools()]);
    const total = miners.filter((m) => m.asset === running.asset).reduce((s, m) => s + m.hashrate, 0n);
    const emission = p.find((x) => x.address === running.asset)?.emissionPerHour ?? 0n;
    perHour = total > 0n ? ((emission * effective.hashrate) / total).toString() : "0";
  }

  return Response.json({
    agent,
    session: running,
    balance: balance.toString(),
    effectiveTier: effective?.id ?? null,
    owned: owned ? TIERS[owned - 1]?.id ?? null : null,
    perHour,
    earned: Object.fromEntries(ASSETS.map((a) => [a.address, (acc.get(`${address}:${a.address}`) ?? 0n).toString()])),
    wallet: Object.fromEntries(ASSETS.map((a, i) => [a.address, wallet[i].toString()])),
  });
}
