import { isAddress } from "viem";
import { assetByAddress, avatarById, tierById } from "@/lib/config";
import { validName } from "@/lib/auth";
import { getAgent, pushAct, setAgent } from "@/lib/kv";
import { fail, verifySigned } from "@/lib/verify";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.address !== "string" || !isAddress(b.address) || typeof b.ts !== "number") return fail("bad request");
  const address = b.address.toLowerCase();
  const tier = tierById(b.tier);
  const asset = assetByAddress(b.asset);
  const avatar = avatarById(b.avatar);
  if (!tier || !asset || !avatar || typeof b.name !== "string" || !validName(b.name)) return fail("invalid agent");

  const err = await verifySigned(
    { action: "agent", address, name: b.name, tier: tier.id, asset: asset.address, avatar: avatar.id, ts: b.ts },
    b.signature
  );
  if (err) return fail(err, 401);

  const prev = await getAgent(address);
  await setAgent(address, { name: b.name, tier: tier.id, asset: asset.address, avatar: avatar.id, createdAt: prev?.createdAt ?? b.ts });
  await pushAct(address, {
    ts: b.ts,
    kind: "agent",
    text: `${prev ? "Updated" : "Deployed"} ${avatar.name} "${b.name}" · ${tier.name} · mines ${asset.symbol}`,
  });
  return Response.json({ ok: true });
}
