import { isAddress, type Address } from "viem";
import { SESSION_SECONDS, TIERS, TOKEN_ADDRESS, tierById } from "@/lib/config";
import { ownedTier, tokenBalance } from "@/lib/chain";
import { getAgent, getSession, pushAct, setSession } from "@/lib/kv";
import { fail, verifySigned } from "@/lib/verify";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.address !== "string" || !isAddress(b.address) || typeof b.ts !== "number") return fail("bad request");
  const address = b.address.toLowerCase() as Address;

  const err = await verifySigned({ action: "session", address, ts: b.ts }, b.signature);
  if (err) return fail(err, 401);

  const agent = await getAgent(address);
  if (!agent) return fail("deploy a VGA first", 404);
  const now = Math.floor(Date.now() / 1000);
  const current = await getSession(address);
  if (current && current.end > now) return fail("a session is already running", 409);
  // a bought VGA mines without holding; otherwise the balance must cover the smallest one
  if ((await ownedTier(address)) === 0 && (await tokenBalance(TOKEN_ADDRESS, address)) < TIERS[0].minHold)
    return fail("buy a VGA or hold enough to deploy one", 403);

  const session = { start: now, end: now + SESSION_SECONDS, tier: agent.tier, asset: agent.asset };
  await setSession(address, session);
  await pushAct(address, { ts: now, kind: "session", text: `Started a ${SESSION_SECONDS / 3600}-hour session on ${tierById(agent.tier)?.name ?? agent.tier}` });
  return Response.json({ ok: true, session });
}
