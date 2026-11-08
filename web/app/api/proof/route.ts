import { isAddress, zeroHash, type Address } from "viem";
import { CHALLENGE_DELAY, POOL_ADDRESS, assetByAddress } from "@/lib/config";
import { poolAbi, poolRead } from "@/lib/chain";
import { getTreeDump } from "@/lib/kv";
import { loadTree } from "@/lib/merkle";

const none = { cumulative: "0", claimable: "0", proof: [] };

/** Proof against the root claims use right now, plus what is still unclaimed. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const raw = q.get("address") ?? "";
  const asset = assetByAddress(q.get("asset"));
  if (!isAddress(raw) || !asset) return Response.json({ error: "bad request" }, { status: 400 });
  const address = raw.toLowerCase() as Address;

  const [active, [pending, publishedAt], claimed] = await Promise.all([
    poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "root" }),
    poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "pendingRoot" }),
    poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "claimedBy", args: [address, asset.address] }),
  ]);
  // The contract promotes a matured pending root lazily, inside claim() itself.
  const matured = pending !== zeroHash && Date.now() / 1000 >= Number(publishedAt) + CHALLENGE_DELAY;
  const root = matured ? pending : active;
  const dump = root === zeroHash ? null : await getTreeDump(root);
  if (!dump) return Response.json(none);

  const tree = loadTree(dump);
  for (const [i, v] of tree.entries()) {
    if (v[0].toLowerCase() === address && v[1].toLowerCase() === asset.address) {
      const cumulative = BigInt(v[2]);
      const claimable = cumulative > claimed ? cumulative - claimed : 0n;
      return Response.json({ cumulative: v[2], claimable: claimable.toString(), proof: tree.getProof(i) });
    }
  }
  return Response.json(none);
}
