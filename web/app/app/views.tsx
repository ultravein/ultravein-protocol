"use client";
import { useEffect, useState } from "react";
import { formatUnits, zeroAddress } from "viem";
import { ASSETS, EPOCH_SECONDS, SESSION_SECONDS, TIERS, TOKEN_SYMBOL, type TierId } from "@/lib/config";
import { fmt } from "@/lib/format";
import { Chart, Segmented, type Datum } from "../charts";
import { ChipIcon, HourBlocks, MachineFigure, TanksFigure } from "../iso";
import { Gpu3D } from "../gpu3d";

// --- shared types and helpers ------------------------------------------------------

export type Me = {
  agent: { name: string; tier: TierId; asset: string } | null; // the wallet's VGA rig
  session: { start: number; end: number; tier: TierId; asset: string } | null;
  balance: string;
  effectiveTier: TierId | null;
  owned: TierId | null; // VGA bought from the shop, kept for good
  node: string | null; // terminal node linked to this rig
  perHour: string;
  earned: Record<string, string>;
  wallet: Record<string, string>;
};
export type Proof = { claimable: string; cumulative: string; proof: `0x${string}`[] };
export type Hist = { e: number; asset: string; amount: string; tier: string | null; secs: number };
export type Act = { ts: number; kind: "agent" | "session"; text: string };
export type Net = { e: number; agents: number; hashrate: Record<string, string>; pools: Record<string, string>; emitted: Record<string, string> };
export type Pool = { symbol: string; address: string; balance: string; committed: string; claimed: string; emissionPerHour: string; hashrate: string };
export type Row = { address: string; name: string; tier: string; asset: string; end: number; hashrate: string };
export type Stats = { deployed: number; pools: Pool[]; agents: Row[]; shop: { token: string | null; prices: string[] } };

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
  saveAgent: (name: string, tier: TierId, asset: string) => void;
  buyCard: (tier: TierId) => void;
  linkNode: (code: string) => void;
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
      <span className="view__n" aria-hidden="true">{kicker}</span>
      <div className="view__titles">
        <p className="kicker">dashboard / {title.toLowerCase()}</p>
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
  return <div className="hint">Not connected. Use <b>Connect wallet</b> in the header to load your VGA, earnings and claims.</div>;
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
  const card = eff ?? chosen ?? TIERS[0];
  return (
    <>
      <Head kicker="01" title={me?.agent ? `Rig ${me.agent.name}` : "Overview"}>
        {!me?.agent && <button className="btn" onClick={() => d.go("create")}>Deploy a VGA <span aria-hidden="true">→</span></button>}
      </Head>
      <ConnectHint d={d} />
      <div className="tiles">
        <Tile i={0} label={`${TOKEN_SYMBOL} balance`} value={d.connected ? fmt(me?.balance ?? "0") : "—"} sub={me?.owned ? "your VGA is bought, no hold needed" : "unlocks a free VGA"} />
        <Tile i={1} label="VGA" value={eff?.name ?? chosen?.name ?? "—"} sub={eff ? `${eff.hashrate} H/s · ${me?.owned === eff.id ? "owned" : "held"}` : "none running yet"} />
        <Tile i={2} label="Est. per hour" value={running ? fmt(me?.perHour ?? "0") : "—"} sub={running ? symbolOf(running.asset) : "start a session"} />
        <Tile i={3} label="Earned" value={fmt(me?.earned?.[asset] ?? "0")} sub={`${symbolOf(asset)} · ${claimableAssets} claimable`} />
      </div>
      {/* row 1: your VGA in 3D beside its terminal and uptime blocks */}
      <div className="dgrid dgrid--1-2">
        <Panel title={me?.agent ? me.agent.name : "Your VGA"} aside={<span className={`state ${running ? "is-on" : ""}`}>{running ? "mining" : "idle"}</span>}>
          <div className={`agent-stage ${running ? "is-live" : ""}`}>
            <Gpu3D tier={card.id} running={!!running} label={card.name} />
            {me?.agent ? (
              <dl className="agent-stage__tags">
                <div><dt>VGA</dt><dd>{card.name}</dd></div>
                <div><dt>Source</dt><dd>{me.owned === card.id ? "bought" : eff ? "held" : "—"}</dd></div>
                <div><dt>Vein</dt><dd>{symbolOf(asset)}</dd></div>
              </dl>
            ) : (
              <button className="btn" onClick={() => d.go("create")}>Deploy a VGA <span aria-hidden="true">→</span></button>
            )}
          </div>
        </Panel>
        <Panel title="Terminal" aside={<span className={`state ${running ? "is-on" : ""}`}>{running ? "online" : me?.node ? "offline" : "not linked"}</span>}>
          <div className="session">
            <HourBlocks progress={elapsed} running={!!running} />
            {running ? (
              <p className="muted">Mining {symbolOf(running.asset)} on {eff?.name ?? "no VGA"} · up {hms(d.now - running.start)}. Each lit block is an hour your terminal stayed on.</p>
            ) : (
              <p className="muted">{me?.node ? <>Your VGA mines while its terminal runs. Start it with <code>node rig.mjs start</code>.</> : <>Link a terminal on the <button className="linkbtn" onClick={() => d.go("create")}>Deploy VGA</button> tab, then run <code>node rig.mjs start</code>.</>}</p>
            )}
          </div>
        </Panel>
      </div>
      <div className="dgrid dgrid--2-1">
        <Panel title={`Earned per hour · ${symbolOf(asset)}`} aside={<span className="label">last 24 epochs</span>}>
          <Chart data={earnedSeries(d.hist, asset, 24, d.now)} unit={symbolOf(asset)} title={`Earned per hour in ${symbolOf(asset)}`} empty="No earnings yet. They appear after your first full epoch." />
        </Panel>
        <Panel title="Recent activity" aside={<button className="linkbtn" onClick={() => d.go("activity")}>All activity →</button>}>
          <Timeline d={d} limit={6} />
        </Panel>
      </div>
    </>
  );
}

// --- Terminal ----------------------------------------------------------------------

/** Run the rig from a terminal: download, init (prints a code), paste the code here, start. */
function TerminalPanel({ d }: { d: Dash }) {
  const [origin, setOrigin] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => setOrigin(location.origin), []); // after mount, so server and client render alike
  const node = d.me?.node;
  const cmds = [`curl -fsSLo rig.mjs ${origin}/rig.mjs`, `node rig.mjs init ${origin}`, "node rig.mjs start"];
  return (
    <Panel title="04 · Run it from your terminal" aside={<span className={`state ${node ? "is-on" : ""}`}>{node ? `node ${node.slice(0, 6)}…` : "no node yet"}</span>}>
      <ol className="term-steps">
        <li><span>01</span><div><b>Get the rig</b><p>Needs Node.js 18+. <a href="/rig.mjs" download>Download rig.mjs</a> or run:</p><pre className="term">{cmds[0]}</pre></div></li>
        <li><span>02</span><div><b>Make a node</b><p>It prints a code like <code>UV-8K2F-QX7M-41PD</code>.</p><pre className="term">{cmds[1]}</pre></div></li>
        <li>
          <span>03</span>
          <div>
            <b>Paste the code</b>
            <div className="term-link">
              <input placeholder="UV-XXXX-XXXX-XXXX" aria-label="Node code" value={code} maxLength={17} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button className="btn" onClick={() => d.linkNode(code.trim())} disabled={d.busy || !/^UV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code.trim())}>Link</button>
            </div>
          </div>
        </li>
        <li><span>04</span><div><b>Start mining</b><p>Your VGA mines while this runs. Close it and it stops within 10 minutes.</p><pre className="term">{cmds[2]}</pre></div></li>
      </ol>
    </Panel>
  );
}

// --- Deploy VGA --------------------------------------------------------------------

/** Two ways onto the network: deploy a VGA your held balance unlocks, or buy one for good. */
export function DeployVga({ d }: { d: Dash }) {
  const me = d.me;
  const [name, setName] = useState(me?.agent?.name ?? "");
  const [tier, setTier] = useState<TierId>(me?.agent?.tier ?? TIERS[0].id);
  const [asset, setAsset] = useState<string>(me?.agent?.asset ?? ASSETS[0].address);
  // fill the form once the saved rig arrives (it loads after the first render)
  const saved = me?.agent;
  useEffect(() => {
    if (!saved) return;
    setName(saved.name);
    setTier(saved.tier);
    setAsset(saved.asset);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to saved values, not each poll's new object
  }, [saved?.name, saved?.tier, saved?.asset]);
  const balance = BigInt(me?.balance ?? "0");
  const ownedIdx = me?.owned ? TIERS.findIndex((x) => x.id === me.owned) : -1;
  const t = tierOf(tier)!;
  const prices = d.stats?.shop.prices ?? [];
  return (
    <>
      <Head kicker="02" title={me?.agent ? "Your VGA" : "Deploy a VGA"} />
      <ConnectHint d={d} />
      <div className="dgrid dgrid--2-1">
        <div className="stack">
          <Panel title="01 · Pick a VGA" aside={<span className="label">hold to deploy free · or buy it for good</span>}>
            <div className="gpus">
              {TIERS.map((x, i) => {
                const owned = i <= ownedIdx;
                const held = balance >= x.minHold;
                const price = BigInt(prices[i] ?? "0");
                return (
                  <div key={x.id} className={`gpu ${tier === x.id ? "is-on" : ""}`}>
                    <button className="gpu__pick" aria-pressed={tier === x.id} onClick={() => setTier(x.id)}>
                      <ChipIcon size={30} dim={d.connected && !owned && !held} />
                      <b>{x.name}</b>
                      <span>{x.hashrate.toString()} H/s</span>
                      <small>free if you hold {fmt(x.minHold)}</small>
                    </button>
                    {owned ? (
                      <em className="gpu__tag is-owned">owned</em>
                    ) : price > 0n ? (
                      <button className="btn btn--sm gpu__buy" onClick={() => d.buyCard(x.id)} disabled={d.busy}>Buy · {fmt(price)} {TOKEN_SYMBOL}</button>
                    ) : (
                      <em className="gpu__tag">{held && d.connected ? "unlocked" : "sale opens at launch"}</em>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="fine">A bought VGA is yours for good and mines without holding. Its price goes straight into the {TOKEN_SYMBOL} reward pool.</p>
          </Panel>
          <Panel title="02 · Name your rig">
            <input placeholder="Rig name (1-32 characters)" aria-label="Rig name" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          </Panel>
          <Panel title="03 · Reward vein">
            <div className="chips">
              {ASSETS.map((a) => (
                <button key={a.address} className={`chip chip--btn ${asset === a.address ? "is-on" : ""}`} aria-pressed={asset === a.address} onClick={() => setAsset(a.address)}>{a.symbol}</button>
              ))}
            </div>
            <p className="fine">Tokenized stocks are not available to US persons. Changes apply from your next session.</p>
          </Panel>
          <TerminalPanel d={d} />
        </div>
        <div className="stack">
          <Panel title="Preview">
            <Gpu3D tier={t.id} running={false} label={t.name} />
            <div className="rig rig--preview">
              <div className="rig__top">
                <div className="rig__id"><b>{name.trim() || "Your rig"}</b><span>{d.address ? `${d.address.slice(0, 6)}…${d.address.slice(-4)}` : "0x…"}</span></div>
                <span className="live">ready</span>
              </div>
              <div className="rig__stats">
                <div><span className="label">VGA</span><b>{t.name}</b></div>
                <div><span className="label">Hashrate</span><b>{t.hashrate.toString()} H/s</b></div>
                <div><span className="label">Mines</span><b>{symbolOf(asset)}</b></div>
              </div>
              <div className="rig__foot">This is how it appears on the board.</div>
            </div>
            <button className="btn btn--block" style={{ marginTop: 16 }} onClick={() => d.saveAgent(name.trim(), tier, asset)} disabled={d.busy || !name.trim()}>
              {me?.agent ? "Save rig" : "Deploy VGA"} <span aria-hidden="true">→</span>
            </button>
            <p className="fine">One signature. No gas.</p>
          </Panel>
          <Panel title="After deploying">
            <ol className="checklist checklist--tight">
              <li><span>01</span><div><b>Run the terminal</b><p><code>node rig.mjs start</code>: it mines while it stays open.</p></div></li>
              <li><span>02</span><div><b>Keep it powered</b><p>A held VGA needs your balance through each hour. A bought one does not.</p></div></li>
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
  // the 3D card shows the machine you run on; the switcher previews the others
  const [preview, setPreview] = useState<TierId | null>(null);
  const shown = tierOf(preview) ?? eff ?? chosen ?? TIERS[0];
  const checks: [string, boolean, string][] = [
    ["Signature", !!me?.agent, me?.agent ? "rig signed by this wallet" : "deploy a VGA first"],
    ["Hold check", !!eff, eff ? `balance covers ${eff.name}` : `hold ${fmt(TIERS[0].minHold)} to mine`],
    ["Terminal", !!running, running ? `online · up ${hms(d.now - running.start)}` : me?.node ? "run node rig.mjs start" : "link a terminal first"],
    ["Split-proof tiers", true, "one wallet, one rig"],
    ["Release cap", true, "pool pays at most 5% a day"],
  ];
  return (
    <>
      <Head kicker="03" title="Machine">
        <span className={`state ${running ? "is-on" : ""}`}>{running ? "terminal online" : "terminal offline"}</span>
      </Head>
      <ConnectHint d={d} />
      <div className="dgrid dgrid--2-1">
        <Panel title={`${shown.name} · 3D`} aside={<Segmented value={shown.id} onChange={(v) => setPreview(v as TierId)} label="Preview a machine" options={TIERS.map((t) => ({ id: t.id, label: t.name }))} />} className="dpanel--fig">
          <Gpu3D tier={shown.id} running={!!running && shown.id === (eff ?? chosen)?.id} label={shown.name} />
          <div className="meter">
            <div className="meter__bar"><i style={{ transform: `scaleX(${Math.min(1, progress)})` }} /></div>
            <div className="meter__row"><span className="label">Uptime · last 12h</span><span>{running ? `${Math.floor(Math.min(1, progress) * 100)}% · up ${hms(d.now - running.start)}` : "terminal offline"}</span></div>
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
  if (!list.length) return <p className="muted empty-p">Nothing yet. Deploy a VGA and start a session.</p>;
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
        <Chart data={minutes} unit="min" title="Minutes on the vein per hour" empty="Nothing dug yet. Every hour your VGA spends on the vein shows up here." />
      </Panel>
      <div className="dgrid dgrid--1-1">
        <Panel title="Timeline" aside={<Segmented value={filter} onChange={setFilter} label="Filter activity" options={[{ id: "all", label: "All" }, { id: "earn", label: "Earnings" }, { id: "agent", label: "Rig" }]} />}>
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
          <p className="muted empty-p">No VGA is mining right now. Start a session and take the top spot.</p>
        ) : (
          <div className="table-wrap">
            <table className="dtable dtable--board">
              <thead><tr><th>#</th><th>Rig</th><th>VGA</th><th>H/s</th><th>Mines</th><th>Session left</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.address} className={r.address === d.address ? "is-me" : ""}>
                    <td>{pad(i + 1)}</td>
                    <td><span className="who"><ChipIcon size={24} /><b>{r.name}</b><small>{r.address.slice(0, 6)}…{r.address.slice(-4)}</small></span></td>
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
