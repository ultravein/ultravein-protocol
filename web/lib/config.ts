import { zeroAddress, type Address } from "viem";

export const CHAIN_ID = 4663;
export const EPOCH_SECONDS = 3600;
export const SESSION_SECONDS = 12 * 3600;
// Each epoch releases 0.1% of an asset's remaining pool (~2.4% a day), in parts per million.
export const EMISSION_PPM = 1000n;
export const MAX_EPOCHS_PER_RUN = 24;
// Mirrors MiningPool.CHALLENGE_DELAY.
export const CHALLENGE_DELAY = 30 * 60;

const e18 = 10n ** 18n;

export const TIERS = [
  { id: "rtx3060", name: "RTX 3060", minHold: 100_000n * e18, hashrate: 1n },
  { id: "rtx4090", name: "RTX 4090", minHold: 1_000_000n * e18, hashrate: 10n },
  { id: "a100", name: "A100", minHold: 5_000_000n * e18, hashrate: 55n },
  { id: "h100", name: "H100", minHold: 10_000_000n * e18, hashrate: 120n },
] as const;

export type Tier = (typeof TIERS)[number];
export type TierId = Tier["id"];

export const tierById = (id: unknown): Tier | undefined => TIERS.find((t) => t.id === id);

const env = (v: string | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);

export const TOKEN_ADDRESS = env(
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
  "0x000000000000000000000000000000000000dEaD"
).toLowerCase() as Address;
export const TOKEN_SYMBOL = env(process.env.NEXT_PUBLIC_TOKEN_SYMBOL, "TOKEN");
export const POOL_ADDRESS = env(process.env.NEXT_PUBLIC_POOL_ADDRESS, zeroAddress).toLowerCase() as Address;

// Production splits the site (ultravein.org) from the dashboard (app.ultravein.org).
// Unset, both stay relative on one origin (local dev, *.vercel.app).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
/** Link into the dashboard, e.g. appLink("#create"). */
export const appLink = (hash = "") => (APP_URL ? `${APP_URL}/${hash}` : `/app${hash}`);
/** Link to a page of the main site, e.g. siteLink("/#board"). */
export const siteLink = (path: string) => `${SITE_URL}${path}`;

// Until the token launches its address is a placeholder; it is then left out of the reward pools.
export const TOKEN_LIVE = !!process.env.NEXT_PUBLIC_TOKEN_ADDRESS?.trim();

// All assets use 18 decimals. Addresses are lowercase so they work as map keys.
export const ASSETS: readonly { symbol: string; address: Address }[] = [
  { symbol: "ETH", address: zeroAddress },
  ...(TOKEN_LIVE ? [{ symbol: TOKEN_SYMBOL, address: TOKEN_ADDRESS }] : []),
  { symbol: "MSFT", address: "0xe93237c50d904957cf27e7b1133b510c669c2e74" },
  { symbol: "AAPL", address: "0xaf3d76f1834a1d425780943c99ea8a608f8a93f9" },
  { symbol: "NVDA", address: "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec" },
];

export const assetByAddress = (a: unknown) =>
  typeof a === "string" ? ASSETS.find((x) => x.address === a.toLowerCase()) : undefined;
