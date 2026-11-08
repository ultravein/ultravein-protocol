"use client";
import { createWalletClient, custom, publicActions, type Address, type EIP1193Provider } from "viem";
import { rh } from "./chain";

export async function connectWallet() {
  const eth = (globalThis as { ethereum?: EIP1193Provider }).ethereum;
  if (!eth) throw new Error("No wallet found. Install a browser wallet to continue.");
  // public actions too, so a buy can wait for its approval through the same provider
  const wallet = createWalletClient({ chain: rh, transport: custom(eth) }).extend(publicActions);
  const [address] = await wallet.requestAddresses();
  try {
    await wallet.switchChain({ id: rh.id });
  } catch {
    await wallet.addChain({ chain: rh });
  }
  return { wallet, address: address.toLowerCase() as Address };
}
