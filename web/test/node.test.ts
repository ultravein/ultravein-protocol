import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { nodeMessage, nodeSigned, pairCode, validCode, validNodeId } from "../lib/node";

// the same key handling public/rig.mjs uses
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const node = publicKey.export({ format: "jwk" }).x as string;
const sig = (m: string) => sign(null, Buffer.from(m), privateKey).toString("base64url");

describe("terminal node", () => {
  it("accepts the id format rig.mjs produces", () => {
    expect(validNodeId(node)).toBe(true);
    expect(validNodeId("short")).toBe(false);
  });

  it("verifies a heartbeat signed by the node key", () => {
    const m = nodeMessage("beat", node, 1000);
    expect(nodeSigned(node, m, sig(m))).toBe(true);
  });

  it("rejects a signature over another timestamp or kind", () => {
    expect(nodeSigned(node, nodeMessage("beat", node, 1001), sig(nodeMessage("beat", node, 1000)))).toBe(false);
    expect(nodeSigned(node, nodeMessage("node", node, 1000), sig(nodeMessage("beat", node, 1000)))).toBe(false);
  });

  it("rejects another node's signature", () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    const m = nodeMessage("beat", node, 1000);
    expect(nodeSigned(node, m, sign(null, Buffer.from(m), other).toString("base64url"))).toBe(false);
  });

  it("pair codes are UV-XXXX-XXXX-XXXX without look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      const c = pairCode();
      expect(validCode(c)).toBe(true);
      expect(c.slice(3)).not.toMatch(/[01OI]/);
    }
  });
});
