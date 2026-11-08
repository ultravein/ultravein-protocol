import { getNet } from "@/lib/kv";

export const dynamic = "force-dynamic";

/** The network per epoch for the last week, oldest first. */
export async function GET() {
  const net = await getNet();
  return Response.json({ net: net.slice(-168) }, { headers: { "cache-control": "public, s-maxage=60" } });
}
