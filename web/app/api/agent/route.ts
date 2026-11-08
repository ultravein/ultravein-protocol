import { isAddress } from "viem";
import { assetByAddress, tierById } from "@/lib/config";
import { validName } from "@/lib/auth";
import { getAgent, pushAct, setAgent } from "@/lib/kv";
import { fail, verifySigned } from "@/lib/verify";

// Deploys (or re-configures) the wallet's VGA rig: its name, the card it runs and the vein it mines.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.address !== "string" || !isAddress(b.address) || typeof b.ts !== "number") return fail("bad request");
  const address = b.address.toLowerCase();
  const tier = tierById(b.tier);
  const asset = assetByAddress(b.asset);
  if (!tier || !asset || typeof b.name !== "string" || !validName(b.name)) return fail("invalid rig");

  const err = await verifySigned({ action: "rig", address, name: b.name, tier: tier.id, asset: asset.address, ts: b.ts }, b.signature);
  if (err) return fail(err, 401);

  const prev = await getAgent(address);
  await setAgent(address, { name: b.name, tier: tier.id, asset: asset.address, createdAt: prev?.createdAt ?? b.ts });
  await pushAct(address, {
    ts: b.ts,
    kind: "agent",
    text: `${prev ? "Updated" : "Deployed"} rig "${b.name}" · ${tier.name} · mines ${asset.symbol}`,
  });
  return Response.json({ ok: true });
}
