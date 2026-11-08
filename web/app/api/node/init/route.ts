import { PAIR_TTL, pairCode, verifyNode } from "@/lib/node";
import { setPair } from "@/lib/kv";
import { fail } from "@/lib/verify";

// `node rig.mjs init`: the terminal proves it holds its key and gets a short code to paste on the
// Deploy page. Nothing is bound until a wallet signs that code.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad request");
  const err = await verifyNode("node", b.node, b.ts, b.sig);
  if (err) return fail(err, 401);
  const code = pairCode();
  const exp = Math.floor(Date.now() / 1000) + PAIR_TTL;
  await setPair(code, { node: b.node, exp });
  return Response.json({ code, exp });
}
