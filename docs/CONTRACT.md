# MiningPool

`contracts/src/MiningPool.sol` · Solidity 0.8.28 · OpenZeppelin 5 · no proxy, no upgrade path.

One contract holds every reward pool, pays claims against cumulative merkle roots, and runs the VGA shop.

## Constants

| Name | Value | Meaning |
|---|---|---|
| `ETH` | `address(0)` | Native ETH is asset zero |
| `RELEASE_BPS_PER_DAY` | `500` | A root may commit at most 5% of an asset's unallocated balance per day elapsed |
| `CHALLENGE_DELAY` | `30 minutes` | A published root waits this long (guardian may veto) before claims use it |
| `WITHDRAW_DELAY` | `48 hours` | Owner withdrawals of unowed funds wait this long, in public |

## Roles

| Role | Can | Cannot |
|---|---|---|
| `owner` | `setAsset`, `setShop`, `setRoles`, propose / cancel / execute withdrawals of **unallocated** funds | Touch committed (owed) rewards, skip the 48 h delay |
| `publisher` | `publish` a new root | Exceed the release cap, publish while a root is pending |
| `guardian` | `veto` a pending root within 30 minutes | Move funds |
| anyone | `fund`, `buyCard`, `claim` own rewards, `promote` | — |

## Functions

```solidity
// funding
function fund(address asset, uint256 amount) payable           // ETH: asset = address(0), msg.value = amount

// VGA shop
function buyCard(uint8 tier)                                    // pays cardPrice[tier] − cardSpent[msg.sender]
function setShop(address token, uint256[] prices)               // owner; prices[i] is the price of tier i + 1, 0 = off sale

// settlement
function publish(bytes32 root, address[] assets, uint256[] newCommitted)   // publisher; assets strictly ascending
function veto()                                                             // guardian, within CHALLENGE_DELAY
function promote()                                                          // anyone; applies a root past its delay
function claim(address asset, uint256 cumulative, bytes32[] proof)

// admin
function setAsset(address asset, bool allowed)
function setRoles(address owner, address publisher, address guardian)
function proposeWithdraw(address asset, uint256 amount, address to) returns (uint256 id)
function cancelWithdraw(uint256 id)
function executeWithdraw(uint256 id)                                        // after WITHDRAW_DELAY, ≤ unallocated

// views
root() · pendingRoot() · committed(asset) · claimed(asset) · claimedBy(account, asset)
unallocated(asset) · allowed(asset) · lastPublishAt() · withdrawals(id)
cardToken() · cardPrice(tier) · cardOf(account) · cardSpent(account)
```

## The VGA shop

- The owner sets the payment token and a price per tier with `setShop`. The token must also be an allowed asset, because the payment **becomes that token's reward bucket**.
- `buyCard(tier)` requires `tier > cardOf[msg.sender]` and a non-zero price. It charges only the difference over what the wallet already paid (`cardSpent`), records `cardOf = tier`, and emits `CardBought` and `Funded`.
- A bought card is permanent. The off-chain job treats it as powered without any holding.

## Leaves and roots

```
leaf = keccak256(bytes.concat(keccak256(abi.encode(account, asset, cumulative))))
```

OpenZeppelin `StandardMerkleTree` format. `cumulative` is everything ever allocated to `account` in `asset`; a claim pays `cumulative − claimedBy[account][asset]`.

`publish` checks, per asset: `newCommitted ≥ committed` and `newCommitted − committed ≤ unallocated × 500 × elapsed / (1 day × 10 000)`. The pending root's increase is excluded from `unallocated` until it is promoted or vetoed, so a withdrawal can never take it.

## Events and errors

```
event Funded(address from, address asset, uint256 amount)
event Published(bytes32 root, address[] assets, uint256[] newCommitted)
event Promoted(bytes32 root)          event Vetoed(bytes32 root)
event Claimed(address account, address asset, uint256 amount)
event AssetSet(address asset, bool allowed)
event RolesSet(address owner, address publisher, address guardian)
event WithdrawProposed(uint256 id, address asset, uint256 amount, address to, uint64 readyAt)
event WithdrawCancelled(uint256 id)   event WithdrawExecuted(uint256 id)
event ShopSet(address token, uint256[] prices)
event CardBought(address buyer, uint8 tier, uint256 paid)

error Unauthorized  NotAllowed  BadInput  PendingExists  OverCap(address)  BadProof
      NothingToClaim  OverCommitted  NothingToVeto  NotReady  OverUnallocated  TransferFailed
```

## Tests

`contracts/test/MiningPool.t.sol`, 24 Foundry tests: funding, publish caps, veto and promotion, claims and replays, withdraw timelock and limits, and the shop (payment into the pool, upgrade pays the difference, no same or lower tier, unpriced tier, unlisted token, owner only).

```bash
cd contracts && forge test -vv
```
