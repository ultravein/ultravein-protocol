# Ultravein

Ultravein: holders deploy an agent, pick a machine and a reward asset (ETH, our token, MSFT, AAPL, NVDA), and mine in 12-hour sessions on Robinhood Chain (EVM 4663). Rewards come from per-asset pools funded by the project.

- Contract: `contracts/src/MiningPool.sol` (no proxy, no upgrade)
- App + API + hourly job: `web/`

## How rewards work

1. Every hour (epoch) the job reads each mining agent's **lowest** token balance during that hour (from Transfer logs) and caps its tier to it.
2. Each asset pool releases 0.1% of what is left in it, split by `hashrate × seconds mined`.
3. Cumulative totals go into a merkle root. `MiningPool` waits 30 minutes (guardian may veto) and never lets one root commit more than 5% of a pool per day.
4. Holders claim per asset, whenever they like.

## Test

```powershell
cd contracts; & "$env:USERPROFILE\.foundry\bin\forge.exe" test
cd web; npm install; npx vitest run; npm run build
```

End to end on a local fork (anvil on :8545 with `--chain-id 4663`, MockToken + MiningPool deployed, `next dev` pointed at them with `CRON_SECRET=dev`):

```powershell
$env:E2E_API="http://localhost:3001"; node scripts/e2e-fork.mjs <pool> <token>
```

## Deploy

`contracts/lib` is not committed: copy `forge-std` and `openzeppelin-contracts` into it (or `forge install`).

1. **Contract.** Three different wallets: `OWNER` (admin, withdraw with a 48 h timelock), `PUBLISHER` (hot key on the server, holds only gas), `GUARDIAN` (veto).
   ```powershell
   cd contracts
   $env:TOKEN="<token>"; $env:OWNER="<owner>"; $env:PUBLISHER="<publisher>"; $env:GUARDIAN="<guardian>"
   forge script script/Deploy.s.sol --rpc-url https://rpc.mainnet.chain.robinhood.com --private-key <deployer> --broadcast
   ```
2. **Fund the pools** from the owner wallet: `fund(asset, amount)` (approve the token first; ETH uses `address(0)` and `msg.value`).
3. **Web on Vercel** (Hobby: deploy from a folder outside any other git repo). Env vars as in `web/.env.example`, plus an Upstash Redis integration.
4. **Hourly cron**: cron-job.org (or similar) → `POST https://<site>/api/epoch/run` with header `authorization: Bearer <CRON_SECRET>`, every hour at minute 5. Missed runs catch up (24 epochs per run).

## Known limits

- The publisher is trusted to compute fairly; the release cap, veto window and public tree bound the damage.
- A wallet with an EIP-7702 sweeper delegation forwards any ETH it claims to the sweeper. That is the wallet's problem, but worth a warning in the UI copy if users report "missing" claims.
- Stock tokens can block a recipient or pause; that claim reverts and the reward stays claimable.
