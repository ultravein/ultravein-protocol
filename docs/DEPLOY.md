# Deploy

Everything below runs on Robinhood Chain mainnet (chain id `4663`, RPC `https://rpc.mainnet.chain.robinhood.com`). Use fresh wallets that no other project shares.

## 1. Wallets

| Wallet | Holds | Used for |
|---|---|---|
| Deployer | gas for one deployment | `forge script` only |
| Owner | nothing hot; ideally a hardware wallet or Safe | `setAsset`, `setShop`, `setRoles`, withdrawals (48 h timelock) |
| Publisher | a little ETH for gas | the server key that calls `publish` every hour (`PUBLISHER_KEY`) |
| Guardian | a little ETH for gas | `veto` within 30 minutes of a bad root |

## 2. Contract

`contracts/lib` is not committed:

```bash
cd contracts
forge install foundry-rs/forge-std@v1.16.2 OpenZeppelin/openzeppelin-contracts@v5.7.0 --no-git
forge test
```

Deploy (lists ETH, MSFT, AAPL and NVDA; add `TOKEN` to list the project token too):

```bash
export OWNER_ADDRESS=0x… PUBLISHER_ADDRESS=0x… GUARDIAN_ADDRESS=0x…   # TOKEN=0x… once it exists
forge script script/Deploy.s.sol --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --private-key <deployer key> --broadcast
```

Verify: `forge verify-contract <address> src/MiningPool.sol:MiningPool --verifier sourcify --chain 4663`. To verify on Blockscout itself (its API is often behind Cloudflare), write the standard JSON input with `forge verify-contract <address> src/MiningPool.sol:MiningPool --show-standard-json-input > verify-miningpool.json`, then run `node script/verify-blockscout.mjs <address>`.

## 3. After the token launches

From the owner wallet:

1. `setAsset(token, true)` if it was not listed at deploy time.
2. `setShop(token, [priceRtx3060, priceRtx4090, priceA100, priceH100])` in token units (18 decimals). A `0` keeps that tier off sale.
3. Set `NEXT_PUBLIC_TOKEN_ADDRESS` and `NEXT_PUBLIC_TOKEN_SYMBOL` on the site and redeploy.

## 4. Fund the pools

`fund(asset, amount)` from any wallet: approve the token first; for ETH pass `address(0)` and send `msg.value = amount`. VGA purchases fund the token pool automatically.

## 5. Web (Vercel)

Env vars (see `web/.env.example`):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_POOL_ADDRESS` | MiningPool address |
| `NEXT_PUBLIC_TOKEN_ADDRESS` / `NEXT_PUBLIC_TOKEN_SYMBOL` | project token, once launched |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | `https://your-domain` / `https://app.your-domain` (optional; unset keeps one origin) |
| `RH_RPC` | Robinhood Chain RPC |
| `PUBLISHER_KEY` | publisher private key (server only) |
| `CRON_SECRET` | long random string |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash Redis (Vercel integration sets these) |

On the Hobby plan, deploy from a copy of `web/` outside any git repository (`vercel deploy <folder> --prod`). With `NEXT_PUBLIC_APP_URL` set, the app subdomain serves the dashboard at `/` and the main domain redirects `/app` there.

## 6. Hourly settlement

Vercel Hobby cron runs once a day (a safety net; each run catches up to 24 hours). For hourly settlement this repo ships `.github/workflows/epoch.yml`: add repository secrets `SITE_URL` (the app origin) and `CRON_SECRET`. It calls `POST /api/epoch/run` at minute 5 of every hour.

## 7. Smoke test

1. Open the dashboard, deploy a rig, link a terminal (`node rig.mjs init`, paste the code), run `node rig.mjs start`.
2. Wait for the next hour plus five minutes; the Overview chart and `GET /api/me` show the first allocation.
3. After the root's 30-minute window, claim from Portfolio.

## Local fork end to end

```bash
anvil --fork-url <rh rpc> --chain-id 4663
# deploy MockToken + MiningPool to the fork, then start the app pointed at them:
RIG_BEAT_WINDOW=86400 CRON_SECRET=dev PUBLISHER_KEY=<anvil key 1> NEXT_PUBLIC_POOL_ADDRESS=… \
  NEXT_PUBLIC_TOKEN_ADDRESS=… RH_RPC=http://127.0.0.1:8545 npx next dev
E2E_API=http://localhost:3000 node scripts/e2e-fork.mjs <pool> <token>
```

`RIG_BEAT_WINDOW` stretches a heartbeat so it outlasts the fork's time jumps; never set it in production.
