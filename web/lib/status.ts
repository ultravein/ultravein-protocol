import { zeroAddress, type Address } from "viem";
import { ASSETS, TIERS, TOKEN_ADDRESS, tierById } from "./config";
import { activeMiners, pools } from "./active";
import { ownedTier, publicClient, tokenBalance } from "./chain";
import { getAcc, getAgent, getSession, getWalletNode } from "./kv";
import { effectiveTier } from "./mining";

/** Everything the dashboard and the terminal show about one wallet's rig. */
export async function rigStatus(address: Address, { wallet: withWallet = false } = {}) {
  const [agent, session, balance, owned, acc, node, wallet] = await Promise.all([
    getAgent(address),
    getSession(address),
    tokenBalance(TOKEN_ADDRESS, address),
    ownedTier(address).catch(() => 0),
    getAcc(),
    getWalletNode(address),
    // what the wallet holds of each reward asset, for the portfolio view
    withWallet
      ? Promise.all(
          ASSETS.map((a) =>
            (a.address === zeroAddress ? publicClient.getBalance({ address }) : tokenBalance(a.address, address)).catch(() => 0n)
          )
        )
      : Promise.resolve(null),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const running = session && session.end > now ? session : null;
  const chosen = tierById(running?.tier ?? agent?.tier);
  const effective = chosen ? effectiveTier(chosen, balance, owned) : undefined;

  let perHour = 0n;
  if (running && effective) {
    const [miners, p] = await Promise.all([activeMiners(now), pools()]);
    const total = miners.filter((m) => m.asset === running.asset).reduce((s, m) => s + m.hashrate, 0n);
    const emission = p.find((x) => x.address === running.asset)?.emissionPerHour ?? 0n;
    perHour = total > 0n ? (emission * effective.hashrate) / total : 0n;
  }

  return {
    agent,
    session: running,
    node,
    balance: balance.toString(),
    effectiveTier: effective?.id ?? null,
    owned: owned ? (TIERS[owned - 1]?.id ?? null) : null,
    perHour: perHour.toString(),
    earned: Object.fromEntries(ASSETS.map((a) => [a.address, (acc.get(`${address}:${a.address}`) ?? 0n).toString()])),
    wallet: wallet ? Object.fromEntries(ASSETS.map((a, i) => [a.address, wallet[i].toString()])) : undefined,
    // raw for callers that decide eligibility
    _owned: owned,
    _balance: balance,
  };
}
