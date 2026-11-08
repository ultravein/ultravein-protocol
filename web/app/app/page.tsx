"use client";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { ASSETS, POOL_ADDRESS, type TierId } from "@/lib/config";
import { messageFor } from "@/lib/auth";
import { poolAbi, rh } from "@/lib/chain";
import { useWallet } from "../wallet";
import { AgentAvatar, SilverDefs } from "../iso";
import { Activity, CreateAgent, Leaderboard, Machine, Overview, Pools, Portfolio, type Act, type Dash, type Hist, type Me, type Net, type Proof, type Stats } from "./views";

const TABS = [
  { id: "overview", label: "Overview", View: Overview },
  { id: "create", label: "Create agent", View: CreateAgent },
  { id: "machine", label: "Machine", View: Machine },
  { id: "activity", label: "Activity", View: Activity },
  { id: "portfolio", label: "Portfolio", View: Portfolio },
  { id: "pools", label: "Pools", View: Pools },
  { id: "leaderboard", label: "Leaderboard", View: Leaderboard },
] as const;
type TabId = (typeof TABS)[number]["id"];

const nowSec = () => Math.floor(Date.now() / 1000);

export default function AppPage() {
  const { conn, connect } = useWallet();
  const [tab, setTab] = useState<TabId>("overview");
  const [now, setNow] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [proofs, setProofs] = useState<Record<string, Proof>>({});
  const [hist, setHist] = useState<Hist[]>([]);
  const [act, setAct] = useState<Act[]>([]);
  const [net, setNet] = useState<Net[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // the tab lives in the URL hash so it survives reloads and can be linked
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as TabId);
    };
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  const go = (id: string) => {
    location.hash = id;
    scrollTo({ top: 0 });
  };

  const loadPublic = useCallback(async () => {
    const [s, n] = await Promise.all([fetch("/api/stats").then((r) => r.json()), fetch("/api/network").then((r) => r.json())]);
    if (s.pools) setStats(s);
    if (n.net) setNet(n.net);
  }, []);

  const loadMine = useCallback(async (address: Address) => {
    const [m, h, ps] = await Promise.all([
      fetch(`/api/me?address=${address}`).then((r) => r.json()),
      fetch(`/api/history?address=${address}`).then((r) => r.json()),
      Promise.all(ASSETS.map((a) => fetch(`/api/proof?address=${address}&asset=${a.address}`).then((r) => r.json()))),
    ]);
    if (!m.error) setMe(m);
    if (h.hist) {
      setHist(h.hist);
      setAct(h.act);
    }
    setProofs(Object.fromEntries(ASSETS.map((a, i) => [a.address, ps[i]])));
  }, []);

  useEffect(() => {
    setNow(nowSec());
    const clock = setInterval(() => setNow(nowSec()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const load = () => {
      loadPublic().catch(() => {});
      if (conn) loadMine(conn.address).catch(() => {});
    };
    load();
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [conn, loadPublic, loadMine]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : String(e));
    } finally {
      setBusy(false);
    }
  };

  // actions ask for the wallet only when they need it
  const ensure = async () => conn ?? (await connect());

  const signAndPost = async (url: string, body: Record<string, unknown>, message: string) => {
    const c = await ensure();
    const signature = await c.wallet.signMessage({ account: c.address, message });
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, signature }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Request failed");
  };

  const d: Dash = {
    connected: !!conn,
    address: conn?.address ?? null,
    now,
    me,
    proofs,
    hist,
    act,
    net,
    stats,
    busy,
    go,
    saveAgent: (name: string, tier: TierId, asset: string, avatar: string) =>
      run(async () => {
        const { address } = await ensure();
        const a = { action: "agent" as const, address, name, tier, asset, avatar, ts: nowSec() };
        await signAndPost("/api/agent", a, messageFor(a));
        await loadMine(address);
        setMsg("Agent saved.");
        go("machine");
      }),
    startSession: () =>
      run(async () => {
        const { address } = await ensure();
        const a = { action: "session" as const, address, ts: nowSec() };
        await signAndPost("/api/session", a, messageFor(a));
        await loadMine(address);
        setMsg("Session started. Your rig is running.");
      }),
    claim: (asset: string) =>
      run(async () => {
        const c = await ensure();
        const p = proofs[asset];
        const hash = await c.wallet.writeContract({
          account: c.address,
          chain: rh,
          address: POOL_ADDRESS,
          abi: poolAbi,
          functionName: "claim",
          args: [asset as Address, BigInt(p.cumulative), p.proof],
        });
        setMsg(`Claim sent: ${hash.slice(0, 10)}…`);
        setTimeout(() => loadMine(c.address), 5000);
      }),
  };

  const View = TABS.find((t) => t.id === tab)!.View;
  const digging = !!(me?.session && me.session.end > now);

  return (
    <div className="dash">
      <SilverDefs />
      {/* command bar: agent status | numbered tabs | wallet, pinned under the site header */}
      <div className="dash__bar">
        <div className="dash__agent">
          <AgentAvatar kind={me?.agent?.avatar ?? "scout"} size={40} still />
          <div>
            <b>{me?.agent?.name ?? "No agent yet"}</b>
            <span className={`state ${digging ? "is-on" : ""}`}>{digging ? "digging" : "idle"}</span>
          </div>
        </div>
        <nav className="dash__tabs" aria-label="Dashboard">
          {TABS.map((t, i) => (
            <a key={t.id} href={`#${t.id}`} className={tab === t.id ? "is-on" : ""} aria-current={tab === t.id ? "page" : undefined}>
              <i aria-hidden="true">{String(i + 1).padStart(2, "0")}</i>
              {t.label}
            </a>
          ))}
        </nav>
        <div className="dash__wallet">
          <span className="label">Wallet</span>
          {conn ? <b>{conn.address.slice(0, 6)}…{conn.address.slice(-4)}</b> : <button className="linkbtn" onClick={() => run(async () => void (await connect()))}>Connect →</button>}
          <span className="label">On the vein · <b>{stats?.agents.length ?? 0}</b></span>
        </div>
      </div>
      <div className="dash__main" key={tab}>
        <View d={d} />
        {msg && <p className="toast" role="status">{msg}</p>}
      </div>
    </div>
  );
}
