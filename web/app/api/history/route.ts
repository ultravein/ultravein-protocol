import { isAddress } from "viem";
import { getAct, getHist } from "@/lib/kv";

/** One wallet's per-epoch results and its activity log, oldest first. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(raw)) return Response.json({ error: "bad address" }, { status: 400 });
  const address = raw.toLowerCase();
  const [hist, act] = await Promise.all([getHist(address), getAct(address)]);
  return Response.json({ hist, act });
}
