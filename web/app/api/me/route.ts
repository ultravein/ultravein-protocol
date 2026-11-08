import { isAddress, type Address } from "viem";
import { rigStatus } from "@/lib/status";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(raw)) return Response.json({ error: "bad address" }, { status: 400 });
  const { _owned, _balance, ...s } = await rigStatus(raw.toLowerCase() as Address, { wallet: true });
  void _owned;
  void _balance;
  return Response.json(s);
}
