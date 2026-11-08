import { describe, expect, it } from "vitest";
import { encodeAbiParameters, keccak256 } from "viem";
import { buildTree, totalsByAsset } from "../lib/merkle";

const a = "0x00000000000000000000000000000000000000aa";
const b = "0x00000000000000000000000000000000000000bb";
const eth = "0x0000000000000000000000000000000000000000";
const nvda = "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec";

const acc = new Map<string, bigint>([
  [`${a}:${eth}`, 100n],
  [`${b}:${eth}`, 200n],
  [`${a}:${nvda}`, 7n],
  [`${b}:${nvda}`, 0n],
]);

describe("merkle", () => {
  it("hashes leaves exactly like MiningPool.claim", () => {
    const tree = buildTree(acc)!;
    for (const [, v] of tree.entries()) {
      const inner = keccak256(
        encodeAbiParameters(
          [{ type: "address" }, { type: "address" }, { type: "uint256" }],
          [v[0] as `0x${string}`, v[1] as `0x${string}`, BigInt(v[2])]
        )
      );
      expect(tree.leafHash(v)).toBe(keccak256(inner));
    }
  });

  it("drops zero entries and proves each leaf", () => {
    const tree = buildTree(acc)!;
    expect([...tree.entries()].length).toBe(3);
    for (const [i, v] of tree.entries()) expect(tree.verify(v, tree.getProof(i))).toBe(true);
  });

  it("returns null when there is nothing to commit", () => {
    expect(buildTree(new Map())).toBeNull();
  });

  it("totals per asset", () => {
    expect(totalsByAsset(acc).get(eth)).toBe(300n);
    expect(totalsByAsset(acc).get(nvda)).toBe(7n);
  });
});
