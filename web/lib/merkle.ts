import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

export type Leaf = [string, string, string]; // account, asset, cumulative (decimal string)
export const LEAF_TYPES = ["address", "address", "uint256"];

/** acc keys are `${account}:${asset}`, values cumulative amounts. Zero entries are left out. */
export function buildTree(acc: Map<string, bigint>) {
  const values: Leaf[] = [];
  for (const [key, v] of acc) {
    if (v <= 0n) continue;
    const [account, asset] = key.split(":");
    values.push([account, asset, v.toString()]);
  }
  return values.length ? StandardMerkleTree.of(values, LEAF_TYPES) : null;
}

export function totalsByAsset(acc: Map<string, bigint>) {
  const out = new Map<string, bigint>();
  for (const [key, v] of acc) {
    const asset = key.split(":")[1];
    out.set(asset, (out.get(asset) ?? 0n) + v);
  }
  return out;
}

export function loadTree(dump: string) {
  return StandardMerkleTree.load<Leaf>(JSON.parse(dump));
}
