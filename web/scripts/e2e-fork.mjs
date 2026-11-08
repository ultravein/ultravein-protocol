// End-to-end check against a local anvil fork of Robinhood Chain.
// Needs: anvil on :8545 (chain id 4663), MockToken + MiningPool deployed, `next dev` on :3000
// started with that pool/token, PUBLISHER_KEY = anvil key 1 and CRON_SECRET=dev.
// Usage: node scripts/e2e-fork.mjs <pool> <token>
import { createPublicClient, createTestClient, createWalletClient, http, parseAbi, parseEther, zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const [pool, token] = process.argv.slice(2);
const API = process.env.E2E_API ?? "http://localhost:3000";
const chain = { id: 4663, name: "rh-fork", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } };
const transport = http("http://127.0.0.1:8545");
const pub = createPublicClient({ chain, transport });
const test = createTestClient({ chain, transport, mode: "anvil" });
// funder = anvil key 0. The miner is a fresh key: on the real chain most anvil default
// addresses carry an EIP-7702 sweeper delegation that forwards any ETH they receive.
const funder = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const miner = privateKeyToAccount(generatePrivateKey());
await test.setBalance({ address: miner.address, value: parseEther("1") });
const as = (account) => createWalletClient({ chain, transport, account });

const tokenAbi = parseAbi(["function mint(address,uint256)", "function approve(address,uint256) returns (bool)"]);
const poolAbi = parseAbi([
  "function fund(address,uint256) payable",
  "function promote()",
  "function claim(address,uint256,bytes32[])",
]);
const ok = (cond, what) => {
  if (!cond) throw new Error(`FAILED: ${what}`);
  console.log(`ok - ${what}`);
};
const send = async (hash) => pub.waitForTransactionReceipt({ hash });
const post = (path, body) =>
  fetch(API + path, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer dev" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
const msg = (lines) => lines.join("\n");

// 1. miner holds 2M tokens (RTX 4090 tier), pool holds 10 ETH
await send(await as(funder).writeContract({ address: token, abi: tokenAbi, functionName: "mint", args: [miner.address, parseEther("2000000")] }));
await send(await as(funder).writeContract({ address: pool, abi: poolAbi, functionName: "fund", args: [zeroAddress, parseEther("10")], value: parseEther("10") }));

// 2. deploy agent and start a session with signed messages
const addr = miner.address.toLowerCase();
let ts = Math.floor(Date.now() / 1000);
const agentMsg = msg(["ultravein rig", `address: ${addr}`, "name: Fork Rig", "tier: rtx4090", `asset: ${zeroAddress}`, `ts: ${ts}`]);
const agentBody = { address: addr, name: "Fork Rig", tier: "rtx4090", asset: zeroAddress, ts };
let r = await post("/api/agent", { ...agentBody, signature: await miner.signMessage({ message: agentMsg }) });
ok(r.status === 200, `agent created (${JSON.stringify(r.body)})`);
r = await post("/api/agent", { ...agentBody, signature: await miner.signMessage({ message: agentMsg }) });
ok(r.status === 401, "replayed signature rejected");
ts += 1;
r = await post("/api/session", { address: addr, ts, signature: await miner.signMessage({ message: msg(["ultravein session", `address: ${addr}`, `ts: ${ts}`]) }) });
ok(r.status === 200, `session started (${JSON.stringify(r.body)})`);

// 3. two hours pass on chain; the hourly job allocates and publishes
await test.increaseTime({ seconds: 7200 });
await test.mine({ blocks: 1 });
r = await post("/api/epoch/run", {});
console.log(JSON.stringify(r.body));
const earned = BigInt(r.body.added?.[`${addr}:${zeroAddress}`] ?? 0);
ok(r.status === 200 && earned > 0n, `epoch allocated ${earned} wei`);
ok(!!r.body.published?.root, "root published");

// 4. after the challenge delay the miner claims
await test.increaseTime({ seconds: 1900 });
await test.mine({ blocks: 1 });
await send(await as(funder).writeContract({ address: pool, abi: poolAbi, functionName: "promote" }));
const proof = await fetch(`${API}/api/proof?address=${addr}&asset=${zeroAddress}`).then((x) => x.json());
ok(BigInt(proof.claimable) === earned, `proof claimable ${proof.claimable}`);
const before = await pub.getBalance({ address: miner.address });
const receipt = await send(await as(miner).writeContract({ address: pool, abi: poolAbi, functionName: "claim", args: [zeroAddress, BigInt(proof.cumulative), proof.proof] }));
const after = await pub.getBalance({ address: miner.address });
ok(after - before + receipt.gasUsed * receipt.effectiveGasPrice === earned, "claim paid exactly the earned amount");
console.log("E2E PASSED");
