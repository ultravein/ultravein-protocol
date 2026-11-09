# contracts

Foundry project for `MiningPool`: per-asset reward pools, capped merkle settlement, the VGA shop and timelocked admin. Full reference: [`../docs/CONTRACT.md`](../docs/CONTRACT.md).

```bash
forge install foundry-rs/forge-std@v1.16.2 OpenZeppelin/openzeppelin-contracts@v5.7.0 --no-git   # lib/ is not committed
forge test -vv
```

| Path | |
|---|---|
| `src/MiningPool.sol` | the contract |
| `test/MiningPool.t.sol` | 24 tests |
| `script/Deploy.s.sol` | deploy; env `OWNER_ADDRESS`, `PUBLISHER_ADDRESS`, `GUARDIAN_ADDRESS`, optional `TOKEN` |
| `script/verify-blockscout.mjs` | verify on Robinhood Chain's Blockscout when its API is behind Cloudflare |

Deploy steps: [`../docs/DEPLOY.md`](../docs/DEPLOY.md).
