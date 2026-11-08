"use client";
import { createContext, useContext, useState } from "react";
import type { Address, WalletClient } from "viem";
import { connectWallet } from "@/lib/wallet";

type Conn = { wallet: WalletClient; address: Address };
const Ctx = createContext<{ conn: Conn | null; connect: () => Promise<Conn> } | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const connect = async () => {
    const c = await connectWallet();
    setConn(c);
    return c;
  };
  return <Ctx.Provider value={{ conn, connect }}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}

export function ConnectButton() {
  const { conn, connect } = useWallet();
  const [err, setErr] = useState<string | null>(null);
  if (conn)
    return (
      <span className="btn ghost wallet-btn is-on">
        <i aria-hidden="true" />
        {conn.address.slice(0, 6)}…{conn.address.slice(-4)}
      </span>
    );
  return (
    <button
      className="btn ghost wallet-btn"
      title={err ?? undefined}
      onClick={() => connect().catch((e) => setErr(e instanceof Error ? e.message.split("\n")[0] : String(e)))}
    >
      <i aria-hidden="true" />
      {err ? "Retry connect" : "Connect wallet"}
    </button>
  );
}
