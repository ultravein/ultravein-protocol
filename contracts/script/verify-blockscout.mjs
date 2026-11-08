// Verify MiningPool on Robinhood Chain's Blockscout via its REST v2 API.
// Cloudflare challenges forge's verifier client, but lets a browser User-Agent through.
//
//   forge verify-contract <addr> src/MiningPool.sol:MiningPool --show-standard-json-input > verify-miningpool.json
//   node script/verify-blockscout.mjs <addr>

import { readFileSync } from "node:fs";

const addr = process.argv[2];
if (!addr) throw new Error("usage: node script/verify-blockscout.mjs <address>");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const BASE = "https://robinhoodchain.blockscout.com/api/v2/smart-contracts";

// PowerShell may write the file with a BOM; JSON.parse would choke on it
const input = readFileSync("verify-miningpool.json", "utf8").replace(/^﻿/, "");
const form = new FormData();
form.set("compiler_version", "v0.8.28+commit.7893614a");
form.set("contract_name", "MiningPool");
form.set("autodetect_constructor_args", "true");
form.set("license_type", "mit");
form.set("files[0]", new Blob([input], { type: "application/json" }), "MiningPool.json");

const r = await fetch(`${BASE}/${addr}/verification/via/standard-input`, {
  method: "POST",
  body: form,
  headers: { "user-agent": UA, accept: "application/json" },
  signal: AbortSignal.timeout(60_000),
});
console.log("submit:", r.status, (await r.text()).slice(0, 200));

// verification runs async; poll the contract until it reports verified
for (let i = 0; i < 20; i++) {
  await new Promise((s) => setTimeout(s, 6000));
  const c = await fetch(`${BASE}/${addr}`, { headers: { "user-agent": UA, accept: "application/json" } }).then((x) => x.json()).catch(() => null);
  if (c?.is_verified) {
    console.log("verified:", c.name, c.compiler_version, "evm", c.evm_version);
    process.exit(0);
  }
}
console.log("not verified yet; check the explorer later");
