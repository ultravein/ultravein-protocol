import { isAddress } from "viem";
import { validCode } from "@/lib/node";
import { getPair, pushAct, setNodeOwner, setPair, setWalletNode } from "@/lib/kv";
import { fail, verifySigned } from "@/lib/verify";

// The wallet signs the code its terminal printed; from then on that terminal powers its rig.
// Linking a new node replaces the old one, so a lost terminal is fixed by running init again.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.address !== "string" || !isAddress(b.address) || typeof b.ts !== "number") return fail("bad request");
  const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  if (!validCode(code)) return fail("that is not a UV-XXXX-XXXX-XXXX code");
  const address = b.address.toLowerCase();

  const err = await verifySigned({ action: "link", address, code, ts: b.ts }, b.signature);
  if (err) return fail(err, 401);

  const pair = await getPair(code);
  const now = Math.floor(Date.now() / 1000);
  if (!pair || pair.exp < now) return fail("code expired or unknown: run init again", 404);
  await setPair(code, { node: pair.node, exp: 0 }); // one use
  await setNodeOwner(pair.node, address);
  await setWalletNode(address, pair.node);
  await pushAct(address, { ts: now, kind: "agent", text: `Linked terminal node ${pair.node.slice(0, 8)}…` });
  return Response.json({ ok: true, node: pair.node });
}
