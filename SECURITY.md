# Security

## Reporting

Found a bug that could lose or freeze funds, mint unearned rewards, or let someone power a rig they do not own? Please report it privately through GitHub's **Report a vulnerability** button on this repository (Security tab), not in a public issue. Include the steps to reproduce and the impact you expect. We aim to reply within 72 hours.

## Trust model, in short

| Part | Trusted for | Bounded by |
|---|---|---|
| Publisher (server hot key) | Computing each hour's reward totals | 5% per pool per day release cap, 30-minute guardian veto, public merkle tree |
| Guardian | Vetoing a bad root | Can only veto, never move funds |
| Owner | Listing assets, shop prices, roles, withdrawing unowed funds | Withdrawals are public on chain and wait 48 hours; owed rewards can never be withdrawn |
| Terminal node key | Proving a rig's terminal is running | Holds no funds, cannot claim, cannot change the rig |

`MiningPool` has no proxy and no upgrade path. What is deployed is what runs.

## Known limits

- The hourly job is off chain. A wrong publisher can only misallocate up to the daily cap, and the guardian can veto within 30 minutes.
- A wallet with an EIP-7702 sweeper delegation forwards any ETH it claims to the sweeper. That is the wallet's configuration, not a contract bug.
- Tokenized stock contracts can block recipients or pause. Such a claim reverts and the reward stays claimable.
- Heartbeats prove a terminal is running, not that GPU work was done. Rewards stay bounded per wallet by the VGA it holds or owns.
