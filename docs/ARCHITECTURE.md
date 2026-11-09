# Architecture

Ultravein has four moving parts: a contract that holds the money, a web app with an API, an hourly job that turns uptime into rewards, and a terminal client that switches rigs on.

```
 holder's terminal                      web (Next.js on Vercel)                    Robinhood Chain (4663)
┌─────────────────┐  heartbeat /5 min  ┌──────────────────────────────┐   reads    ┌──────────────────────┐
│  node rig.mjs   │ ─────────────────▶ │ /api/node/beat  → session    │ ◀───────── │ token Transfer logs  │
│  (Ed25519 key)  │                    │ /api/agent      → rig config │            │ MiningPool.cardOf    │
└─────────────────┘                    │ /api/node/link  → node↔wallet│            │ pool balances        │
                                       │                              │            │                      │
 holder's wallet ── signs rig/link ──▶ │ KV (Upstash Redis)           │  publish   │ MiningPool           │
                 ── buyCard / claim ─────────────────────────────────────────────▶ │  · per-asset buckets │
                                       │ hourly job /api/epoch/run    │ ─────────▶ │  · merkle roots      │
                                       │   (GitHub Actions, :05)      │            │  · VGA shop          │
                                       └──────────────────────────────┘            └──────────────────────┘
```

## Lifecycle of one rig

1. **Get a VGA.** Either hold the token (the VGA your balance covers is free to run) or buy one with `MiningPool.buyCard(tier)`. A bought VGA is recorded in `cardOf[wallet]` forever and needs no holding.
2. **Deploy the rig.** The wallet signs `ultravein rig` with a name, the VGA it wants and the reward asset ("vein"). Stored in KV.
3. **Link a terminal.** `node rig.mjs init` registers an Ed25519 key and gets a one-time code; the wallet signs `ultravein link` with that code. The node is now bound to the wallet.
4. **Mine.** `node rig.mjs start` sends a signed heartbeat every 5 minutes. Each one sets the session to end 10 minutes later, so the rig is "on" exactly while the terminal runs.
5. **Settle.** Every hour the job measures each rig's online seconds and VGA, splits the hour's release, and publishes a cumulative merkle root.
6. **Claim.** After the 30-minute veto window the wallet claims each asset with its proof.

## The hourly job

`web/lib/epoch.ts`, run by `POST /api/epoch/run` (bearer `CRON_SECRET`):

1. Finds the block range of every finished hour since the last run (up to 24 per run, so a missed run catches up).
2. For every rig online in that range, rebuilds its **lowest token balance** inside each hour from Transfer logs, and reads its bought tier from `cardOf`.
3. Effective VGA = the best one it owns or its lowest balance covers, never above the VGA it picked.
4. Each asset pool releases **0.1% of what is left** in it per hour, split by `hashrate × online seconds`.
5. Adds the shares to cumulative totals, builds an OpenZeppelin `StandardMerkleTree` of `(account, asset, cumulative)`, stores it in KV and calls `MiningPool.publish`.

The contract then refuses any root that commits more than **5% of a pool per day** since the previous root, and holds it for **30 minutes** so the guardian can veto.

## Why these choices

| Choice | Reason |
|---|---|
| Lowest balance in the hour, not the balance at the end | Moving tokens between wallets mid-hour cannot power two rigs. |
| Bigger VGAs never pay less per token held | Splitting one bag across wallets never earns more than holding it in one. |
| Cumulative merkle leaves | A late claim loses nothing; one claim collects everything owed so far. |
| Release cap + veto + timelocked withdraw | The off-chain job is trusted, but its worst case is bounded and public. |
| Heartbeat window instead of fixed sessions | The rig earns exactly while its terminal runs, like a real machine. |
| No proxy | What is deployed is what runs. |

## Storage (KV keys)

| Key | Value |
|---|---|
| `agent:<wallet>` | rig config `{name, tier, asset, createdAt}` (key name kept for compatibility) |
| `session:<wallet>` | `{start, end, tier, asset}`; `end` moves forward with each heartbeat |
| `node:<id>` / `rignode:<wallet>` | node ↔ wallet binding (latest node wins) |
| `pair:<code>` | one-time pairing code `{node, exp}` |
| `nodeTs:<id>` / `lastTs:<wallet>` | last accepted timestamps (replay protection) |
| `acc` | cumulative allocations `account:asset → amount` |
| `epoch` | `{last, block}` progress of the hourly job |
| `hist:<wallet>`, `act:<wallet>`, `net` | dashboard history (bounded) |
| `tree:<root>` | full merkle tree dump, for proofs |

Locally, without Upstash credentials, KV is a JSON file at `web/data/kv.json`.
