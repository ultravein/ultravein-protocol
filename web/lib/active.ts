import { ASSETS, EMISSION_PPM, POOL_ADDRESS, tierById } from "./config";
import { poolAbi, poolBalance, poolRead } from "./chain";
import { getAgent, getSession, listAgents } from "./kv";

/** Agents whose session is running now, with their chosen hashrate. */
export async function activeMiners(now = Math.floor(Date.now() / 1000)) {
  const rows = await Promise.all(
    (await listAgents()).map(async (address) => {
      const [agent, session] = await Promise.all([getAgent(address), getSession(address)]);
      if (!agent || !session || session.end <= now) return null;
      return {
        address,
        name: agent.name,
        tier: session.tier,
        asset: session.asset,
        end: session.end,
        hashrate: tierById(session.tier)?.hashrate ?? 0n,
      };
    })
  );
  return rows.filter((r) => r !== null);
}

// Reads on a pool that is not deployed yet revert; show zero instead of failing the page.
const read = (functionName: "committed" | "claimed", asset: `0x${string}`) =>
  poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName, args: [asset] }).catch(() => 0n);

/** Pool balance, hourly emission (an estimate) and settled totals per asset. */
export async function pools() {
  return Promise.all(
    ASSETS.map(async (a) => {
      const [balance, committed, claimed] = await Promise.all([
        poolBalance(a.address).catch(() => 0n),
        read("committed", a.address),
        read("claimed", a.address),
      ]);
      return { ...a, balance, committed, claimed, emissionPerHour: (balance * EMISSION_PPM) / 1_000_000n };
    })
  );
}
