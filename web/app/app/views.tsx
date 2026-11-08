"use client";
import { useEffect, useState } from "react";
import { formatUnits, zeroAddress } from "viem";
import { ASSETS, AVATARS, EPOCH_SECONDS, SESSION_SECONDS, TIERS, TOKEN_SYMBOL, type TierId } from "@/lib/config";
import { fmt } from "@/lib/format";
import { Chart, Ring, Segmented, type Datum } from "../charts";
import { AgentAvatar, ChipIcon, MachineFigure, RigFigure, TanksFigure } from "../iso";

// --- shared types and helpers ------------------------------------------------------

export type Me = {
  agent: { name: string; tier: TierId; asset: string; avatar?: string } | null;
  session: { start: number; end: number; tier: TierId; asset: string } | null;
  balance: string;
  effectiveTier: TierId | null;
  perHour: string;
  earned: Record<string, string>;
  wallet: Record<string, string>;
};
export type Proof = { claimable: string; cumulative: string; proof: `0x${string}`[] };
export type Hist = { e: number; asset: string; amount: string; tier: string | null; secs: number };
export type Act = { ts: number; kind: "agent" | "session"; text: string };
export type Net = { e: number; agents: number; hashrate: Record<string, string>; pools: Record<string, string>; emitted: Record<string, string> };
export type Pool = { symbol: string; address: string; balance: string; committed: string; claimed: string; emissionPerHour: string; hashrate: string };
export type Row = { address: string; name: string; avatar?: string; tier: string; asset: string; end: number; hashrate: string };
export type Stats = { deployed: number; pools: Pool[]; agents: Row[] };

export type Dash = {
  connected: boolean;
  address: string | null;
  now: number;
  me: Me | null;
  proofs: Record<string, Proof>;
  hist: Hist[];
  act: Act[];
  net: Net[];
  stats: Stats | null;
  busy: boolean;
  saveAgent: (name: string, tier: TierId, asset: string, avatar: string) => void;
  startSession: () => void;
  claim: (asset: string) => void;
  go: (tab: string) => void;
};

const symbolOf = (a: string) => ASSETS.find((x) => x.address === a)?.symbol ?? "?";
const tierOf = (id: string | null | undefined) => TIERS.find((t) => t.id === id);
const units = (v: string | bigint) => Number(formatUnits(BigInt(v), 18));
const hhmm = (e: number) => new Date(e * EPOCH_SECONDS * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const ago = (ts: number, now: number) => {
  const s = Math.max(0, now - ts);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

function Head({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="view__head">
      <div>
        <p className="kicker"><b>{kicker}</b><span className="kicker__rule" aria-hidden="true" />dashboard</p>
        <h1 className="view__title">{title}</h1>
      </div>
      {children}
    </div>
  );
}

function Tile({ label, value, sub, i = 0 }: { label: string; value: React.ReactNode; sub?: React.ReactNode; i?: number }) {
  return (
    <div className="tile" style={{ animationDelay: `${i * 60}ms` }}>
      <span className="label">{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Panel({ title, aside, children, className = "" }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`dpanel ${className}`}>
      {(title || aside) && (
        <div className="dpanel__head">
          {title && <h2>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function ConnectHint({ d }: { d: Dash }) {
  if (d.connected) return null;
  return <div className="hint">Not connected. Use <b>Connect wallet</b> in the header to load your agent, earnings and claims.</div>;
}

/** Earned per epoch for one asset, last `n` epochs, zero-filled. */
function earnedSeries(hist: Hist[], asset: string, n: number, now: number): Datum[] {
  const cur = Math.floor(now / EPOCH_SECONDS) - 1;
  const by = new Map(hist.filter((h) => h.asset === asset).map((h) => [h.e, units(h.amount)]));
  return Array.from({ length: n }, (_, i) => {
    const e = cur - (n - 1) + i;
    return { label: hhmm(e), value: by.get(e) ?? 0 };
  });
}

const assetOptions = ASSETS.map((a) => ({ id: a.address as string, label: a.symbol }));

// --- Overview ----------------------------------------------------------------------

export function Overview({ d }: { d: Dash }) {
  const me = d.me;
  const running = me?.session && me.session.end > d.now ? me.session : null;
  const chosen = tierOf(me?.agent?.tier);
  const eff = tierOf(me?.effectiveTier);
  const asset = running?.asset ?? me?.agent?.asset ?? zeroAddress;
  const elapsed = running ? (d.now - running.start) / SESSION_SECONDS : 0;
  const claimableAssets = Object.values(d.proofs).filter((p) => BigInt(p.claimable) > 0n).length;
  return (
    <>
      <Head kicker="01" title={me?.agent ? `Agent ${me.agent.name}` : "Overview"}>
        {!me?.agent && <button className="btn" onClick={() => d.go("create")}>Create your agent <span aria-hidden="true">→</span></button>}
      </Head>
      <ConnectHint d={d} />
      <div className="tiles">
        <Tile i={0} label={`${TOKEN_SYMBOL} balance`} value={d.connected ? fmt(me?.balance ?? "0") : "—"} sub="powers your card" />
        <Tile i={1} label="Machine" value={eff?.name ?? chosen?.name ?? "—"} sub={eff ? `${eff.hashrate} H/s${chosen && chosen.id !== eff.id ? ` · picked ${chosen.name}` : ""}` : "no tier covered yet"} />
        <Tile i={2} label="Est. per hour" value={running ? fmt(me?.perHour ?? "0") : "—"} sub={running ? symbolOf(running.asset) : "start a session"} />
        <Tile i={3} label="Earned" value={fmt(me?.earned?.[asset] ?? "0")} sub={`${symbolOf(asset)} · ${claimableAssets} claimable`} />
      </div>
      <div className="dgrid dgrid--2-1">
        <Panel title={`Earned per hour · ${symbolOf(asset)}`} aside={<span className="label">last 24 epochs</span>}>
          <Chart data={earnedSeries(d.hist, asset, 24, d.now)} unit={symbolOf(asset)} title={`Earned per hour in ${symbolOf(asset)}`} empty="No earnings yet. They appear after your first full epoch." />
        </Panel>
        <Panel title="Session">
          <div className="session">
            <Ring value={elapsed}>
              <b>{running ? hms(running.end - d.now) : "idle"}</b>
              <small>{running ? "left" : "12h session"}</small>
            </Ring>
            {running ? (
              <p className="muted">Mining {symbolOf(running.asset)} on {eff?.name ?? "no tier"}. Rewards settle every hour.</p>
            ) : (
              <button className="btn" onClick={d.startSession} disabled={d.busy || !me?.agent}>Start mining</button>
            )}
          </div>
        </Panel>
      </div>
      <div className="dgrid dgrid--1-1">
        <Panel title={me?.agent ? me.agent.name : "Your agent"} aside={<span className={`state ${running ? "is-on" : ""}`}>{running ? "on shift" : "idle"}</span>}>
          <div className="agent-stage">
            <AgentAvatar kind={me?.agent?.avatar ?? "scout"} size={220} still={!running} />
            {me?.agent ? (
              <dl className="agent-stage__tags">
                <div><dt>Character</dt><dd>{AVATARS.find((a) => a.id === (me.agent?.avatar ?? "scout"))?.name}</dd></div>
                <div><dt>Machine</dt><dd>{eff?.name ?? chosen?.name ?? "—"}</dd></div>
                <div><dt>Mines</dt><dd>{symbolOf(asset)}</dd></div>
              </dl>
            ) : (
              <button className="btn" onClick={() => d.go("create")}>Create your agent <span aria-hidden="true">→</span></button>
            )}
          </div>
        </Panel>
        <Panel title="Recent activity" aside={<button className="linkbtn" onClick={() => d.go("activity")}>All activity →</button>}>
          <Timeline d={d} limit={6} />
        </Panel>
      </div>
    </>
  );
}

// --- Create agent ------------------------------------------------------------------

export function CreateAgent({ d }: { d: Dash }) {
  const me = d.me;
  const [name, setName] = useState(me?.agent?.name ?? "");
  const [tier, setTier] = useState<TierId>(me?.agent?.tier ?? TIERS[0].id);
  const [asset, setAsset] = useState<string>(me?.agent?.asset ?? ASSETS[0].address);
  const [avatar, setAvatar] = useState<string>(me?.agent?.avatar ?? AVATARS[0].id);
  // fill the form once the saved agent arrives (it loads after the first render)
  const saved = me?.agent;
  useEffect(() => {
    if (!saved) return;
    setName(saved.name);
    setTier(saved.tier);
    setAsset(saved.asset);
    if (saved.avatar) setAvatar(saved.avatar);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to saved values, not each poll's new object
  }, [saved?.name, saved?.tier, saved?.asset, saved?.avatar]);
  const balance = BigInt(me?.balance ?? "0");
  const t = tierOf(tier)!;
  return (
    <>
      <Head kicker="02" title={me?.agent ? "Edit your agent" : "Create your agent"} />
      <ConnectHint d={d} />
      <div className="dgrid dgrid--2-1">
        <div className="stack">
          <Panel title="01 · Character" aside={<span className="label">cosmetic · never changes earnings</span>}>
            <div className="chars" role="radiogroup" aria-label="Agent character">
              {AVATARS.map((a) => (
                <button key={a.id} role="radio" aria-checked={avatar === a.id} className={`char ${avatar === a.id ? "is-on" : ""}`} onClick={() => setAvatar(a.id)}>
                  <AgentAvatar kind={a.id} size={132} still={avatar !== a.id} />
                  <b>{a.name}</b>
                  <small>{a.line}</small>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="02 · Name">
            <input placeholder="Agent name (1-32 characters)" aria-label="Agent name" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          </Panel>
          <Panel title="03 · Machine" aside={<span className="label">optional · your balance unlocks it</span>}>
            <div className="gpus">
              {TIERS.map((x) => {
                const locked = d.connected && balance < x.minHold;
                const per1m = Number(x.hashrate) / (Number(x.minHold / 10n ** 18n) / 1e6);
                return (
                  <button key={x.id} className={`gpu ${tier === x.id ? "is-on" : ""} ${locked ? "is-locked" : ""}`} disabled={locked} aria-pressed={tier === x.id} onClick={() => setTier(x.id)}>
                    <ChipIcon size={30} dim={locked} />
                    <b>{x.name}</b>
                    <span>{x.hashrate.toString()} H/s</span>
                    <small>hold {fmt(x.minHold)}</small>
                    <small>{per1m.toFixed(1)} H/s per 1M</small>
                    {locked && <em>locked</em>}
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel title="04 · Reward">
            <div className="chips">
              {ASSETS.map((a) => (
                <button key={a.address} className={`chip chip--btn ${asset === a.address ? "is-on" : ""}`} aria-pressed={asset === a.address} onClick={() => setAsset(a.address)}>{a.symbol}</button>
              ))}
            </div>
            <p className="fine">Tokenized stocks are not available to US persons. Changes apply from your next session.</p>
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Preview">
            <div className="rig rig--preview">
              <div className="preview__stage"><AgentAvatar kind={avatar} size={150} /></div>
              <div className="rig__top">
                <div className="rig__id"><b>{name.trim() || "Your agent"}</b><span>{d.address ? `${d.address.slice(0, 6)}…${d.address.slice(-4)}` : "0x…"}</span></div>
                <span className="live">ready</span>
              </div>
              <div className="rig__stats">
                <div><span className="label">Machine</span><b>{t.name}</b></div>
                <div><span className="label">Hashrate</span><b>{t.hashrate.toString()} H/s</b></div>
                <div><span className="label">Mines</span><b>{symbolOf(asset)}</b></div>
              </div>
              <div className="rig__foot">This is how it appears on the board.</div>
            </div>
            <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => d.saveAgent(name.trim(), tier, asset, avatar)} disabled={d.busy || !name.trim()}>
              {me?.agent ? "Save agent" : "Deploy agent"} <span aria-hidden="true">→</span>
            </button>
            <p className="fine">One signature. No gas.</p>
          </Panel>
          <Panel title="After deploying">
            <ol className="checklist checklist--tight">
              <li><span>01</span><div><b>Start a session</b><p>12 hours of mining, from the Machine tab.</p></div></li>
              <li><span>02</span><div><b>Hold through each hour</b><p>The lowest balance in the hour sets your card.</p></div></li>
              <li><span>03</span><div><b>Claim</b><p>From Portfolio, once a root passes its 30-minute window.</p></div></li>
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

// --- Machine -----------------------------------------------------------------------

export function Machine({ d }: { d: Dash }) {
  const me = d.me;
  const running = me?.session && me.session.end > d.now ? me.session : null;
  const chosen = tierOf(me?.agent?.tier);
  const eff = tierOf(me?.effectiveTier);
  const balance = BigInt(me?.balance ?? "0");
  const next = TIERS.find((t) => t.minHold > balance);
  const progress = running ? (d.now - running.start) / SESSION_SECONDS : 0;
  const checks: [string, boolean, string][] = [
    ["Signature", !!me?.agent, me?.agent ? "agent signed by this wallet" : "deploy an agent first"],
    ["Hold check", !!eff, eff ? `balance covers ${eff.name}` : `hold ${fmt(TIERS[0].minHold)} to mine`],
    ["Session", !!running, running ? `${hms(running.end - d.now)} left` : "no session running"],
    ["Split-proof tiers", true, "one wallet, one agent"],
    ["Release cap", true, "pool pays at most 5% a day"],
  ];
  return (
    <>
      <Head kicker="03" title="Machine">
        {running ? <span className="state is-on">running</span> : <button className="btn" onClick={d.startSession} disabled={d.busy || !me?.agent}>Start mining</button>}
      </Head>
      <ConnectHint d={d} />
      <div className="dgrid dgrid--2-1">
        <Panel title={me?.agent?.name ?? "No agent yet"} aside={<span className="label">{eff?.name ?? chosen?.name ?? "—"} · {symbolOf(running?.asset ?? me?.agent?.asset ?? zeroAddress)}</span>} className="dpanel--fig">
          <RigFigure agents={running ? 4 : 0} idle={!running} label={me?.agent?.name ?? "no agent"} />
          <div className="meter">
            <div className="meter__bar"><i style={{ transform: `scaleX(${Math.min(1, progress)})` }} /></div>
            <div className="meter__row"><span className="label">Session</span><span>{running ? `${Math.floor(progress * 100)}% · ${hms(running.end - d.now)} left` : "idle"}</span></div>
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Machine">
            <dl className="kv">
              <div><dt>Picked</dt><dd>{chosen?.name ?? "—"}</dd></div>
              <div><dt>Running as</dt><dd>{eff?.name ?? "below RTX 3060"}</dd></div>
              <div><dt>Hashrate</dt><dd>{eff ? `${eff.hashrate} H/s` : "0 H/s"}</dd></div>
              <div><dt>Balance</dt><dd>{fmt(balance)} {TOKEN_SYMBOL}</dd></div>
              <div><dt>Next machine</dt><dd>{next ? `${next.name} at ${fmt(next.minHold)}` : "max card"}</dd></div>
            </dl>
          </Panel>
          <Panel title="Gate checks">
            <ul className="checks">
              {checks.map(([h, ok, p], i) => (
                <li key={h} className={ok ? "is-ok" : ""}>
                  <span className="checks__n">{pad(i + 1)}</span>
                  <div><b>{h}</b><small>{p}</small></div>
                  <span className={`tag ${ok ? "tag--open" : "tag--planned"}`}>{ok ? "pass" : "wait"}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <Panel title="The hourly filter" aside={<span className="label">FIG. 2 · THE FILTER</span>}>
        <MachineFigure />
      </Panel>
    </>
  );
}

// --- Activity ----------------------------------------------------------------------

type Event = { ts: number; kind: "agent" | "session" | "earn" | "idle"; text: string };

function events(d: Dash): Event[] {
  const earn: Event[] = d.hist.map((h) => ({
    ts: (h.e + 1) * EPOCH_SECONDS,
    kind: h.tier ? "earn" : "idle",
    text: h.tier
      ? `Epoch #${h.e} · earned ${fmt(h.amount)} ${symbolOf(h.asset)} on ${tierOf(h.tier)?.name} (${Math.round(h.secs / 60)} min)`
      : `Epoch #${h.e} · balance dipped below RTX 3060, earned nothing`,
  }));
  return [...d.act, ...earn].sort((a, b) => b.ts - a.ts);
}

function Timeline({ d, limit, filter = "all" }: { d: Dash; limit?: number; filter?: string }) {
  const list = events(d).filter((e) => filter === "all" || (filter === "earn" ? e.kind === "earn" || e.kind === "idle" : e.kind === "agent" || e.kind === "session"));
  if (!list.length) return <p className="muted empty-p">Nothing yet. Deploy an agent and start a session.</p>;
  return (
    <ol className="tl">
      {list.slice(0, limit).map((e, i) => (
        <li key={`${e.ts}-${i}`} className={`tl--${e.kind}`}>
          <span className="tl__dot" aria-hidden="true" />
          <div><p>{e.text}</p><small>{ago(e.ts, d.now)}</small></div>
        </li>
      ))}
    </ol>
  );
}

export function Activity({ d }: { d: Dash }) {
  const [filter, setFilter] = useState<"all" | "earn" | "agent">("all");
  const minutes = (() => {
    const cur = Math.floor(d.now / EPOCH_SECONDS) - 1;
    const by = new Map(d.hist.map((h) => [h.e, h.tier ? h.secs / 60 : 0]));
    return Array.from({ length: 48 }, (_, i) => ({ label: hhmm(cur - 47 + i), value: by.get(cur - 47 + i) ?? 0 }));
  })();
  return (
    <>
      <Head kicker="04" title="Activity" />
      <ConnectHint d={d} />
      <Panel title="Minutes on the vein per hour" aside={<span className="label">last 48 epochs</span>}>
        <Chart data={minutes} unit="min" title="Minutes on the vein per hour" empty="Nothing dug yet. Every hour your agent spends on the vein shows up here." />
      </Panel>
      <div className="dgrid dgrid--1-1">
        <Panel title="Timeline" aside={<Segmented value={filter} onChange={setFilter} label="Filter activity" options={[{ id: "all", label: "All" }, { id: "earn", label: "Earnings" }, { id: "agent", label: "Agent" }]} />}>
          <Timeline d={d} limit={40} filter={filter} />
        </Panel>
        <Panel title="Epochs">
          {d.hist.length === 0 ? (
            <p className="muted empty-p">No epochs yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="dtable">
                <thead><tr><th>Epoch</th><th>Time</th><th>Card</th><th>Mined</th><th>Earned</th></tr></thead>
                <tbody>
                  {d.hist.slice(-48).reverse().map((h) => (
                    <tr key={h.e}>
                      <td>#{h.e}</td>
                      <td>{hhmm(h.e)}</td>
                      <td>{tierOf(h.tier)?.name ?? "—"}</td>
                      <td>{Math.round(h.secs / 60)} min</td>
                      <td>{fmt(h.amount)} {symbolOf(h.asset)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

// --- Portfolio ---------------------------------------------------------------------

export function Portfolio({ d }: { d: Dash }) {
  const [asset, setAsset] = useState<string>(d.me?.agent?.asset ?? ASSETS[0].address);
  const cumulative = (() => {
    let run = 0;
    return d.hist
      .filter((h) => h.asset === asset)
      .slice(-168)
      .map((h) => ({ label: hhmm(h.e), value: (run += units(h.amount)) }));
  })();
  return (
    <>
      <Head kicker="05" title="Portfolio" />
      <ConnectHint d={d} />
      <div className="assets">
        {ASSETS.map((a, i) => {
          const p = d.proofs[a.address];
          const claimable = BigInt(p?.claimable ?? "0");
          const claimed = BigInt(p?.cumulative ?? "0") - claimable;
          return (
            <div key={a.address} className="asset" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="asset__top"><ChipIcon size={22} /><b>{a.symbol}</b></div>
              <dl className="kv kv--sm">
                <div><dt>In wallet</dt><dd>{fmt(d.me?.wallet?.[a.address] ?? "0")}</dd></div>
                <div><dt>Earned</dt><dd>{fmt(d.me?.earned?.[a.address] ?? "0")}</dd></div>
                <div><dt>Claimed</dt><dd>{fmt(claimed > 0n ? claimed : 0n)}</dd></div>
                <div><dt>Claimable</dt><dd className="hi">{fmt(claimable)}</dd></div>
              </dl>
              <button className="btn btn--block" disabled={d.busy || claimable === 0n} onClick={() => d.claim(a.address)}>Claim {a.symbol}</button>
            </div>
          );
        })}
      </div>
      <Panel title={`Cumulative earned · ${symbolOf(asset)}`} aside={<Segmented value={asset} onChange={setAsset} label="Asset" options={assetOptions} />}>
        <Chart kind="line" data={cumulative} unit={symbolOf(asset)} title={`Cumulative ${symbolOf(asset)} earned`} empty={`No ${symbolOf(asset)} earned yet.`} />
      </Panel>
      <p className="fine">Earned counts every settled hour. Claimable is what the active root lets you take now; it trails earned by up to one settlement and its 30-minute window.</p>
    </>
  );
}

// --- Pools -------------------------------------------------------------------------

export function Pools({ d }: { d: Dash }) {
  const [asset, setAsset] = useState<string>(ASSETS[0].address);
  const pools = d.stats?.pools ?? [];
  const agents = d.stats?.agents ?? [];
  const mine = d.me?.session && d.me.session.end > d.now ? d.me.session : null;
  const myRate = tierOf(d.me?.effectiveTier)?.hashrate ?? 0n;
  const hashSeries = d.net.slice(-72).map((n) => ({ label: hhmm(n.e), value: Object.values(n.hashrate).reduce((s, v) => s + Number(v), 0) }));
  const poolSeries = d.net.slice(-72).map((n) => ({ label: hhmm(n.e), value: units(n.pools[asset] ?? "0") }));
  return (
    <>
      <Head kicker="06" title="Pools" />
      <div className="dgrid dgrid--1-1">
        <Panel title="Pool levels" aside={<span className="label">FIG. 3 · LIVE</span>}>
          <TanksFigure pools={pools.map((p) => ({ symbol: p.symbol, balance: BigInt(p.balance) }))} />
        </Panel>
        <Panel title="Buckets">
          <div className="table-wrap">
            <table className="dtable">
              <thead><tr><th>Asset</th><th>In pool</th><th>Per hour</th><th>H/s</th><th>Miners</th><th>Your share</th></tr></thead>
              <tbody>
                {pools.map((p) => {
                  const miners = agents.filter((a) => a.asset === p.address).length;
                  const share = mine && mine.asset === p.address && BigInt(p.hashrate) > 0n ? Number((myRate * 10000n) / BigInt(p.hashrate)) / 100 : 0;
                  return (
                    <tr key={p.address}>
                      <td><b>{p.symbol}</b></td>
                      <td>{fmt(p.balance)}</td>
                      <td>{fmt(p.emissionPerHour)}</td>
                      <td>{p.hashrate}</td>
                      <td>{miners}</td>
                      <td>{share ? `${share}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="fine">Each bucket releases 0.1% of itself per hour, split by hashrate × seconds between its miners.</p>
        </Panel>
      </div>
      <div className="dgrid dgrid--1-1">
        <Panel title="Network hashrate" aside={<span className="label">last 72 epochs</span>}>
          <Chart kind="line" data={hashSeries} unit="H/s" title="Network hashrate per epoch" empty="No settled epochs yet." />
        </Panel>
        <Panel title={`Pool balance · ${symbolOf(asset)}`} aside={<Segmented value={asset} onChange={setAsset} label="Asset" options={assetOptions} />}>
          <Chart kind="line" data={poolSeries} unit={symbolOf(asset)} title={`${symbolOf(asset)} pool balance per epoch`} empty="No settled epochs yet." />
        </Panel>
      </div>
    </>
  );
}

// --- Leaderboard -------------------------------------------------------------------

export function Leaderboard({ d }: { d: Dash }) {
  const rows = d.stats?.agents ?? [];
  return (
    <>
      <Head kicker="07" title="Leaderboard">
        <span className="label">{rows.length} mining · {d.stats?.deployed ?? 0} deployed</span>
      </Head>
      <Panel>
        {rows.length === 0 ? (
          <p className="muted empty-p">No agents are mining right now. Start a session and take the top spot.</p>
        ) : (
          <div className="table-wrap">
            <table className="dtable dtable--board">
              <thead><tr><th>#</th><th>Agent</th><th>Card</th><th>H/s</th><th>Mines</th><th>Session left</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.address} className={r.address === d.address ? "is-me" : ""}>
                    <td>{pad(i + 1)}</td>
                    <td><span className="who"><AgentAvatar kind={r.avatar ?? "scout"} size={30} still /><b>{r.name}</b><small>{r.address.slice(0, 6)}…{r.address.slice(-4)}</small></span></td>
                    <td>{tierOf(r.tier)?.name}</td>
                    <td>{r.hashrate}</td>
                    <td>{symbolOf(r.asset)}</td>
                    <td>{hms(Math.max(0, r.end - d.now))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
