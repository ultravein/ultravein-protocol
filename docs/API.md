# API

Base: the dashboard origin (for example `https://app.your-domain`). JSON in, JSON out. Amounts are decimal strings in the asset's smallest unit (18 decimals for every listed asset). Addresses are lowercase.

## Read

| Method | Path | Returns |
|---|---|---|
| GET | `/api/stats` | `deployed`, `shop {token, prices[]}`, `pools[]` (balance, committed, claimed, emissionPerHour, hashrate), `agents[]` (rigs online now, strongest first) |
| GET | `/api/network` | `net[]`: per epoch, rigs online, hashrate, pool levels and released amounts |
| GET | `/api/me?address=` | `agent` (the rig), `session`, `node`, `balance`, `effectiveTier`, `owned`, `perHour`, `earned{asset}`, `wallet{asset}` |
| GET | `/api/history?address=` | `hist[]` per epoch, `act[]` activity log |
| GET | `/api/proof?address=&asset=` | `cumulative`, `claimable`, `proof[]` for `MiningPool.claim` |

```json
GET /api/proof?address=0x…&asset=0x0000000000000000000000000000000000000000
{ "cumulative": "8135000000000000", "claimable": "8135000000000000", "proof": ["0x5f2a…", "0x91c0…"] }
```

## Write (wallet-signed)

Signed with `personal_sign` (EIP-191; contract wallets via ERC-1271). Every field is in the text, so nothing can be swapped after signing. `ts` must be within 5 minutes of the server and newer than the wallet's last accepted `ts`.

| Path | Body | Signed text |
|---|---|---|
| `POST /api/agent` | `{address, name, tier, asset, ts, signature}` | `ultravein rig` · `address:` · `name:` · `tier:` · `asset:` · `ts:` |
| `POST /api/node/link` | `{address, code, ts, signature}` | `ultravein link` · `address:` · `code:` · `ts:` |

```
ultravein rig
address: 0xyouraddress
name: vesper
tier: h100
asset: 0x0000000000000000000000000000000000000000
ts: 1791395618
```

`tier` is one of `rtx3060`, `rtx4090`, `a100`, `h100`. `name` is 1-32 bytes, no outer spaces or control characters.

## Write (node-signed, from `rig.mjs`)

Ed25519 over the text below, signature in base64url. `node` is the raw 32-byte public key in base64url.

| Path | Body | Signed text | Returns |
|---|---|---|---|
| `POST /api/node/init` | `{node, ts, sig}` | `ultravein node\nnode: <id>\nts: <unix>` | `{code, exp}`: one-time pairing code, 30 minutes |
| `POST /api/node/beat` | `{node, ts, sig}` | `ultravein beat\nnode: <id>\nts: <unix>` | live status: `powered`, `rig`, `vga`, `running`, `hashrate`, `asset`, `perHour`, `earned`, `uptime`, `nextEpoch`, `beatEvery` |

## Operator

| Path | Auth | Does |
|---|---|---|
| `POST` or `GET /api/epoch/run` | `authorization: Bearer <CRON_SECRET>` | Settles finished epochs and publishes a root when it changed. `?dry=1` computes without saving or publishing. |
| `POST /api/rpc` | none | JSON-RPC passthrough to the configured Robinhood Chain RPC, for wallets behind networks that block the public one. |

## Errors

Failures return a non-2xx status with `{ "error": "<reason>" }`, for example `401 signature expired, sign again`, `403 this node is not linked`, `404 code expired or unknown: run init again`.
