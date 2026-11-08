import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  parseAbi,
  parseAbiItem,
  zeroAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID, POOL_ADDRESS } from "./config";
import type { Transfer } from "./mining";

export const rh = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

export const RPC_URL = (process.env.RH_RPC ?? rh.rpcUrls.default.http[0]).trim();

export const poolAbi = parseAbi([
  "function root() view returns (bytes32)",
  "function pendingRoot() view returns (bytes32 root, uint64 publishedAt, address[] assets, uint256[] newCommitted)",
  "function claimed(address asset) view returns (uint256)",
  "function committed(address asset) view returns (uint256)",
  "function claimedBy(address account, address asset) view returns (uint256)",
  "function publish(bytes32 newRoot, address[] assets, uint256[] newCommitted)",
  "function claim(address asset, uint256 cumulative, bytes32[] proof)",
  "function cardToken() view returns (address)",
  "function cardPrice(uint8 tier) view returns (uint256)",
  "function cardOf(address account) view returns (uint8)",
  "function cardSpent(address account) view returns (uint256)",
  "function buyCard(uint8 tier)",
  "error OverCap(address asset)",
  "error PendingExists()",
  "error BadProof()",
  "error NothingToClaim()",
  "error OverCommitted()",
  "error TransferFailed()",
]);

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

// The official RPC rate-limits eth_getLogs with 429s; retry patiently.
export const publicClient = createPublicClient({
  chain: rh,
  transport: http(RPC_URL, { retryCount: 6, retryDelay: 4000 }),
});

export function publisherClient() {
  const key = process.env.PUBLISHER_KEY;
  if (!key) throw new Error("PUBLISHER_KEY is not set");
  return createWalletClient({ chain: rh, transport: http(RPC_URL), account: privateKeyToAccount(key as `0x${string}`) });
}

/** ERC-20 balance; an address with no contract (e.g. the token before launch) reads as 0. */
export const tokenBalance = (token: Address, account: Address, blockNumber?: bigint) =>
  publicClient
    .readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account], blockNumber })
    .catch(async (e) => {
      if ((await publicClient.getCode({ address: token }).catch(() => "0x")) === undefined) return 0n;
      throw e;
    });

// Before MiningPool is deployed POOL_ADDRESS is the zero address, whose ETH balance is the chain's
// burn sink. Report an empty pool instead of that.
export const poolBalance = async (asset: Address, blockNumber?: bigint): Promise<bigint> =>
  POOL_ADDRESS === zeroAddress
    ? 0n
    : asset === zeroAddress
    ? publicClient.getBalance({ address: POOL_ADDRESS, blockNumber })
    : tokenBalance(asset, POOL_ADDRESS, blockNumber);

export const poolRead = publicClient.readContract.bind(publicClient);

/** 1-based tier of the VGA `account` bought, 0 if none or the pool is not deployed yet. */
export const ownedTier = async (account: Address): Promise<number> =>
  POOL_ADDRESS === zeroAddress ? 0 : Number(await poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "cardOf", args: [account] }));

/** The shop as the contract has it: payment token and per-tier price (0 = not for sale). */
export async function shop(tiers: number) {
  if (POOL_ADDRESS === zeroAddress) return { token: zeroAddress as Address, prices: Array<bigint>(tiers).fill(0n) };
  const [token, ...prices] = await Promise.all([
    poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "cardToken" }),
    ...Array.from({ length: tiers }, (_, i) => poolRead({ address: POOL_ADDRESS, abi: poolAbi, functionName: "cardPrice", args: [i + 1] })),
  ]);
  return { token: token as Address, prices: prices as bigint[] };
}

export const blockTime = async (n: bigint) => Number((await publicClient.getBlock({ blockNumber: n })).timestamp);

/** Every Transfer of `token` in [fromBlock, toBlock], fetched in chunks the RPC accepts. */
export async function getTransfers(token: Address, fromBlock: bigint, toBlock: bigint, chunk = 50_000n) {
  const out: Transfer[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunk) {
    const end = start + chunk - 1n < toBlock ? start + chunk - 1n : toBlock;
    const logs = await publicClient.getLogs({ address: token, event: transferEvent, fromBlock: start, toBlock: end });
    for (const l of logs)
      out.push({ block: l.blockNumber, logIndex: l.logIndex, from: l.args.from!, to: l.args.to!, value: l.args.value! });
  }
  return out;
}
