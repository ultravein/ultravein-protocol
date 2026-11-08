// Fills a local anvil fork with a few mining agents and some settled hours, so the
// dashboard's charts have data. Needs the same setup as e2e-fork.mjs.
// Usage: node scripts/seed-fork.mjs <pool> <token> [hours=6]
import { createPublicClient, createTestClient, createWalletClient, http, parseAbi, parseEther, zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { linkAndBeat } from "./rig-node.mjs";

const [pool, token, hoursArg] = process.argv.slice(2);
const HOURS = Number(hoursArg ?? 6);
const API = process.env.E2E_API ?? "http://localhost:3000";
const chain = { id: 4663, name: "rh-fork", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } };
const transport = http("http://127.0.0.1:8545");
const pub = createPublicClient({ chain, transport });
const test = createTestClient({ chain, transport, mode: "anvil" });
const funder = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const as = (account) => createWalletClient({ chain, transport, account });
const send = async (hash) => pub.waitForTransactionReceipt({ hash });
const tokenAbi = parseAbi(["function mint(address,uint256)", "function approve(address,uint256) returns (bool)"]);
const poolAbi = parseAbi(["function fund(address,uint256) payable"]);
const post = (path, body) =>
  fetch(API + path, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer dev" }, body: JSON.stringify(body) }).then((r) => r.json());

// fund the token bucket too, so two pools pay out
await send(await as(funder).writeContract({ address: token, abi: tokenAbi, functionName: "mint", args: [funder.address, parseEther("5000000")] }));
await send(await as(funder).writeContract({ address: token, abi: tokenAbi, functionName: "approve", args: [pool, parseEther("5000000")] }));
await send(await as(funder).writeContract({ address: pool, abi: poolAbi, functionName: "fund", args: [token, parseEther("5000000")] }));

const AGENTS = [
  { name: "nightshift", tier: "h100", hold: "12000000", asset: zeroAddress },
  { name: "coldstorage", tier: "a100", hold: "6000000", asset: zeroAddress },
  { name: "slowburn", tier: "rtx4090", hold: "1500000", asset: token.toLowerCase() },
];
for (const a of AGENTS) {
  const acct = privateKeyToAccount(generatePrivateKey());
  const addr = acct.address.toLowerCase();
  await send(await as(funder).writeContract({ address: token, abi: tokenAbi, functionName: "mint", args: [acct.address, parseEther(a.hold)] }));
  // signatures expire after 5 minutes, so take the timestamp right before signing
  const ts = Math.floor(Date.now() / 1000);
  const agentMsg = ["ultravein rig", `address: ${addr}`, `name: ${a.name}`, `tier: ${a.tier}`, `asset: ${a.asset}`, `ts: ${ts}`].join("\n");
  console.log(a.name, await post("/api/agent", { address: addr, name: a.name, tier: a.tier, asset: a.asset, ts, signature: await acct.signMessage({ message: agentMsg }) }));
  const rig = await linkAndBeat(post, acct, addr);
  console.log(a.name, rig.beat.powered ? `terminal ${rig.code} online` : `terminal failed ${JSON.stringify(rig.beat)}`);
  console.log(`  ${a.name}: ${addr}`);
}

for (let h = 0; h < HOURS; h++) {
  await test.increaseTime({ seconds: 3600 });
  await test.mine({ blocks: 1 });
  const r = await post("/api/epoch/run", {});
  console.log(`hour ${h + 1}:`, r.error ?? `epochs ${JSON.stringify(r.epochs)}, published ${r.published?.root ? "yes" : "no"}`);
}
