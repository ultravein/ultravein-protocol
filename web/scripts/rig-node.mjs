// What a holder does with public/rig.mjs, done in one go for the fork scripts:
// make a node key, init (get a code), link the code with the wallet, send one heartbeat.
import { generateKeyPairSync, sign } from "node:crypto";

export async function linkAndBeat(post, acct, address) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const node = publicKey.export({ format: "jwk" }).x;
  const signed = (kind, ts) => ({ node, ts, sig: sign(null, Buffer.from(`ultravein ${kind}\nnode: ${node}\nts: ${ts}`), privateKey).toString("base64url") });
  const now = () => Math.floor(Date.now() / 1000);

  const init = await post("/api/node/init", signed("node", now()));
  const code = (init.body ?? init).code;
  const ts = now();
  const linkMsg = ["ultravein link", `address: ${address}`, `code: ${code}`, `ts: ${ts}`].join("\n");
  const link = await post("/api/node/link", { address, code, ts, signature: await acct.signMessage({ message: linkMsg }) });
  const beat = await post("/api/node/beat", signed("beat", now() + 1));
  return { node, code, link, beat };
}
