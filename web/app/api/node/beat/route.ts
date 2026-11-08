import type { Address } from "viem";
import { ASSETS, EPOCH_SECONDS, TIERS, tierById } from "@/lib/config";
import { BEAT_SECONDS, BEAT_WINDOW, verifyNode } from "@/lib/node";
import { getNodeOwner, getSession, getWalletNode, pushAct, setSession } from "@/lib/kv";
import { rigStatus } from "@/lib/status";
import { fail } from "@/lib/verify";

// `node rig.mjs start` calls this every BEAT_SECONDS. Each beat keeps the rig mining for
// BEAT_WINDOW: stop the terminal and the rig stops within ten minutes, like pulling the plug.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad request");
  const err = await verifyNode("beat", b.node, b.ts, b.sig);
  if (err) return fail(err, 401);

  const owner = await getNodeOwner(b.node);
  // a node whose wallet has since linked a newer one is retired
  if (!owner || (await getWalletNode(owner)) !== b.node) return fail("this node is not linked: paste its code on the Deploy page", 403);
  const address = owner as Address;
  const s = await rigStatus(address);
  if (!s.agent) return fail("deploy a VGA on the dashboard first", 404);

  const now = Math.floor(Date.now() / 1000);
  const powered = s._owned > 0 || s._balance >= TIERS[0].minHold;
  let session = s.session;
  if (powered) {
    const cur = await getSession(address);
    // continuous while beats keep arriving; a changed VGA or vein starts a fresh run
    const same = cur && cur.end > now && cur.tier === s.agent.tier && cur.asset === s.agent.asset;
    session = { start: same ? cur.start : now, end: now + BEAT_WINDOW, tier: s.agent.tier, asset: s.agent.asset };
    await setSession(address, session);
    if (!same) await pushAct(address, { ts: now, kind: "session", text: `Terminal online · ${tierById(s.agent.tier)?.name ?? s.agent.tier}` });
  }

  const asset = s.agent.asset;
  return Response.json({
    powered,
    reason: powered ? null : `buy a VGA or hold ${TIERS[0].minHold / 10n ** 18n} tokens to power one`,
    rig: s.agent.name,
    vga: tierById(s.effectiveTier ?? s.agent.tier)?.name ?? null,
    running: !!s.effectiveTier && powered,
    hashrate: (tierById(s.effectiveTier)?.hashrate ?? 0n).toString(),
    asset: ASSETS.find((a) => a.address === asset)?.symbol ?? "?",
    perHour: s.perHour,
    earned: s.earned[asset] ?? "0",
    uptime: session ? now - session.start : 0,
    nextEpoch: EPOCH_SECONDS - (now % EPOCH_SECONDS),
    beatEvery: BEAT_SECONDS,
  });
}
