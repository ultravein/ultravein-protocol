# rig — the Ultravein terminal client

`rig.mjs` is the switch for your VGA. It links this terminal to your rig with a short code, then keeps the rig mining for as long as it runs.

- **One file, zero dependencies.** Node.js 18 or newer is all it needs.
- **No funds.** It holds an Ed25519 node key that only signs "this terminal is still running". It cannot move tokens, change your rig or claim. Claims happen in your wallet on the dashboard.
- **Served by the site.** The site serves a byte-identical copy at `/rig.mjs` (`web/public/rig.mjs`); CI fails if the two drift. After editing this file run `npm run rig:sync` from the repo root.

## Use

```bash
curl -fsSLo rig.mjs https://<site>/rig.mjs     # or "Download rig.mjs" on the Deploy VGA tab
node rig.mjs init https://<site>               # prints UV-XXXX-XXXX-XXXX
# paste the code on Deploy VGA and sign with your wallet
node rig.mjs start                             # mines while this stays open
```

```
  ultravein rig  ni6TubA7t3…  https://app.example

  rig      vesper  ·  H100
  status   ● mining NVDA   120 H/s
  rate     ~0.0041 NVDA / hour
  earned   0.0213 NVDA   (claim on the dashboard)
  payout   next in 00:41:12
  uptime   03:12:40

  heartbeat in 288s · Ctrl+C to stop (mining stops within 10 min)
```

## Commands

| Command | What it does |
|---|---|
| `node rig.mjs init <site>` | Creates (or reuses) the node key in `~/.ultravein/rig.json`, registers it with `<site>` and prints a one-time code valid for 30 minutes. `--new` forces a fresh key. |
| `node rig.mjs start` | Sends a signed heartbeat every 5 minutes and shows live status. Each heartbeat keeps the rig mining for 10 minutes. |
| `node rig.mjs` | Help. |

## Protocol

Every request is signed with the node key (Ed25519, signature in base64url). The node id is the raw 32-byte public key in base64url.

| Step | Request | Signed text |
|---|---|---|
| init | `POST /api/node/init {node, ts, sig}` → `{code, exp}` | `ultravein node\nnode: <id>\nts: <unix>` |
| link (wallet, on the site) | `POST /api/node/link {address, code, ts, signature}` | `ultravein link\naddress: <0x…>\ncode: <UV-…>\nts: <unix>` (personal_sign) |
| heartbeat | `POST /api/node/beat {node, ts, sig}` → live status | `ultravein beat\nnode: <id>\nts: <unix>` |

`ts` must be within 5 minutes of the server clock and newer than the node's last accepted `ts`, so a captured heartbeat cannot be replayed. Linking a new node retires the previous one for that wallet.

## Troubleshooting

| Message | Fix |
|---|---|
| `clock skew or replay: check your system time` | Sync your system clock. |
| `this node is not linked` | Paste the code from `init` on Deploy VGA (codes expire after 30 minutes; run `init` again for a fresh one). |
| `deploy a VGA on the dashboard first` | Deploy your rig on the Deploy VGA tab, then start again. |
| `○ not powered` | Buy a VGA, or hold enough of the token for the smallest one. |
