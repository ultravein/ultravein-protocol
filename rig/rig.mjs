#!/usr/bin/env node
// Ultravein rig: links this terminal to your VGA and keeps it mining for as long as it runs.
//
//   node rig.mjs init <site>   make this terminal's node key and get a code for the Deploy page
//   node rig.mjs start         run the rig (leave this open; closing it stops mining)
//
// Zero dependencies, Node 18+. The node key lives in ~/.ultravein/rig.json. It holds no funds and
// can claim nothing: it only signs "this terminal is still running". Claims happen in your wallet.
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".ultravein");
const FILE = join(DIR, "rig.json");
const V = (s) => `\x1b[38;5;135m${s}\x1b[0m`; // violet
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const B = (s) => `\x1b[1m${s}\x1b[0m`;
const now = () => Math.floor(Date.now() / 1000);
const die = (m) => (console.error(`\n  ${m}\n`), process.exit(1));
const pad = (n) => String(n).padStart(2, "0");
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
// 18-decimal integer string -> short decimal
const amount = (v) => {
  const n = Number(BigInt(v ?? "0")) / 1e18;
  return n === 0 ? "0" : n < 0.0001 ? n.toExponential(2) : n.toLocaleString("en-US", { maximumFractionDigits: 6 });
};

const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : die("No node yet. Run: node rig.mjs init <site>"));

function signed(cfg, kind) {
  const ts = now();
  const msg = `ultravein ${kind}\nnode: ${cfg.node}\nts: ${ts}`;
  return { node: cfg.node, ts, sig: sign(null, Buffer.from(msg), createPrivateKey(cfg.key)).toString("base64url") };
}

async function post(origin, path, body) {
  const r = await fetch(origin + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

async function init(site) {
  if (!site) die("Usage: node rig.mjs init <site>   (copy the exact command from the Deploy page)");
  const origin = site.replace(/\/+$/, "");
  // keep an existing key, so re-running init just prints a fresh code for the same node
  let cfg = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : null;
  if (!cfg || process.argv.includes("--new")) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    cfg = { node: publicKey.export({ format: "jwk" }).x, key: privateKey.export({ format: "pem", type: "pkcs8" }) };
  }
  cfg.origin = origin;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cfg, null, 1), { mode: 0o600 });
  const { code, exp } = await post(origin, "/api/node/init", signed(cfg, "node")).catch((e) => die(`Could not reach ${origin}: ${e.message}`));
  console.log(`
  ${V("ultravein rig")} ${DIM("· node ready")}

  node   ${cfg.node.slice(0, 10)}…${cfg.node.slice(-6)}
  code   ${B(V(code))}   ${DIM(`expires in ${Math.round((exp - now()) / 60)} min`)}

  1. Paste the code on the Deploy page and sign with your wallet.
  2. Then run:  ${B("node rig.mjs start")}
`);
}

async function start() {
  const cfg = load();
  let last = null, err = null, at = now(), next = 0;

  const beat = async () => {
    try {
      last = await post(cfg.origin, "/api/node/beat", signed(cfg, "beat"));
      err = null;
      at = now();
      next = at + (last.beatEvery ?? 300);
    } catch (e) {
      err = e.message;
      next = now() + 30; // retry soon
    }
  };

  const draw = () => {
    const t = now();
    const lines = [`\x1b[2J\x1b[H`, `  ${V("ultravein rig")}  ${DIM(cfg.node.slice(0, 10) + "…")}  ${DIM(cfg.origin)}`, ""];
    if (err) lines.push(`  ${"\x1b[31m●\x1b[0m"} ${err}`, "", DIM(`  retrying in ${Math.max(0, next - t)}s`));
    else if (last) {
      const live = last.powered && last.running;
      lines.push(
        `  rig      ${B(last.rig)}  ·  ${last.vga ?? "—"}`,
        `  status   ${live ? V("● mining") : "\x1b[33m○ not powered\x1b[0m"} ${last.asset}   ${last.hashrate} H/s`,
        `  rate     ~${amount(last.perHour)} ${last.asset} / hour`,
        `  earned   ${amount(last.earned)} ${last.asset}   ${DIM("(claim on the dashboard)")}`,
        `  payout   next in ${hms(Math.max(0, last.nextEpoch - (t - at)))}`,
        `  uptime   ${live ? hms(last.uptime + (t - at)) : "—"}`,
      );
      if (!last.powered && last.reason) lines.push("", `  ${last.reason}`);
      lines.push("", DIM(`  heartbeat in ${Math.max(0, next - t)}s · Ctrl+C to stop (mining stops within 10 min)`));
    } else lines.push(DIM("  connecting…"));
    process.stdout.write(lines.join("\n") + "\n");
  };

  process.on("SIGINT", () => (console.log("\n  Rig stopped. It stops earning within 10 minutes.\n"), process.exit(0)));
  await beat();
  draw();
  setInterval(async () => {
    if (now() >= next) await beat();
    draw();
  }, 1000);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "init") await init(arg);
else if (cmd === "start") await start();
else console.log(`
  ${V("ultravein rig")}

  node rig.mjs init <site>   link this terminal: prints a code for the Deploy page
  node rig.mjs start         run the rig; it mines while this stays open
`);
