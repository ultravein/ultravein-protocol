import { RPC_URL } from "@/lib/chain";

// Same-origin JSON-RPC proxy: some Indonesian ISPs DNS-block rpc.*.chain.robinhood.com.
export async function POST(req: Request) {
  try {
    const r = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await req.text(),
      cache: "no-store",
    });
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "RPC upstream unreachable" } },
      { status: 502 }
    );
  }
}
