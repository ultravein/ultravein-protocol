"use client";
import { useEffect, useState } from "react";
import { zeroAddress } from "viem";
import { EPOCH_SECONDS, POOL_ADDRESS, SESSION_SECONDS, TIERS, TOKEN_ADDRESS, TOKEN_SYMBOL, appLink } from "@/lib/config";
import { fmt } from "@/lib/format";
import { AgentAvatar, ChipIcon, MachineFigure, RigFigure, SilverDefs, TanksFigure } from "./iso";

type Pool = { symbol: string; address: string; balance: string; committed: string; claimed: string; emissionPerHour: string; hashrate: string };
type Agent = { address: string; name: string; avatar?: string; tier: string; asset: string; end: number; hashrate: string };
type Stats = { deployed: number; pools: Pool[]; agents: Agent[] };

const EXPLORER = "https://robinhoodchain.blockscout.com/address/";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

/** Section rail: a big thin index, its label and an optional note, pinned in the left column. */
function Bar({ n, label, right }: { n: string; label: string; right?: React.ReactNode }) {
  return (
    <div className="hud-bar">
      <span className="hud-bar__n">{n}</span>
      <span className="hud-bar__label">{label}</span>
      {right && <span className="hud-bar__right">{right}</span>}
    </div>
  );
}

function Tag({ kind = "open", children }: { kind?: "open" | "planned" | "none"; children: React.ReactNode }) {
  return <span className={`tag tag--${kind}`}>{children}</span>;
}

// agent.log lines typed into the hero console; `d` is when each appears (ms)
const LOG: { t: string; cls?: string; d: number }[] = [
  { t: "agent nightshift online", cls: "ok", d: 300 },
  { t: "machine  H100 · 120 H/s", cls: "dim", d: 900 },
  { t: "reward   NVDA", cls: "dim", d: 1300 },
  { t: "shift    12h started", d: 1900 },
  { t: "epoch    holding verified", cls: "dim", d: 2700 },
  { t: "earned   +0.0041 NVDA", cls: "ok", d: 3300 },
  { t: "epoch    holding verified", cls: "dim", d: 4300 },
  { t: "earned   +0.0039 NVDA", cls: "ok", d: 4900 },
  { t: "claim    ready", d: 5800 },
];

const SHIFT = [
  { at: 0, h: "Deploy", p: "Name your agent and pick what it mines. One signature." },
  { at: 0.08, h: "Shift starts", p: "Sign once more and it works a 12-hour shift. No gas." },
  { at: 0.5, h: "Paid every hour", p: "Each hour it holds your bag, it earns a share of its pool." },
  { at: 1, h: "Bring it home", p: "Claim what it earned whenever you like, then send it out again." },
];

const RULES = [
  { h: "Signed", p: "Every move your agent makes is signed by your wallet, once. Replays are refused." },
  { h: "Held", p: "The lowest balance you held in the hour is what counts. A dip mid-hour is the dip." },
  { h: "On shift", p: "Agents work 12 hours, then stop. An abandoned agent stops earning." },
  { h: "Fair split", p: "Bigger machines never pay less per token, so splitting a bag never earns more." },
  { h: "Capped", p: "No payout can take more than 5% of a pool a day, and any can be vetoed for 30 minutes." },
];

const FAQ = [
  ["What does my agent actually do?", "It holds your place in a mining pool. For every hour of its shift your bag stays put, it earns a share of the asset you picked."],
  ["Do I need a GPU?", "No. The machine is a choice inside the app. Your held tokens decide which machines you can pick."],
  ["Does it cost gas?", "Deploying and starting shifts are signatures. Only claiming is a transaction."],
  ["What if I sell mid-shift?", "Your agent drops to the machine your lowest balance in that hour covers. Below the smallest machine, that hour earns nothing."],
  ["Can the team take the pool?", "Only what is not owed to miners, through a withdraw that is public on chain and waits 48 hours."],
  ["Why did my ETH claim vanish?", "Some wallets carry an EIP-7702 sweeper delegation that forwards any ETH they receive. Check your wallet before claiming."],
];

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [now, setNow] = useState(0); // 0 until mounted so server and client renders match

  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000));
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((s) => s.pools && setStats(s))
        .catch(() => {});
    load();
    const poll = setInterval(load, 30_000);
    const clock = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  const pools = stats?.pools ?? [];
  const agents = stats?.agents ?? [];
  const eth = pools.find((p) => p.address === zeroAddress);
  const totalHash = pools.reduce((s, p) => s + BigInt(p.hashrate), 0n);
  const epochLeft = now ? (Math.floor(now / EPOCH_SECONDS) + 1) * EPOCH_SECONDS - now : 0;
  const symbolOf = (a: string) => pools.find((p) => p.address === a)?.symbol ?? "?";
  const tierName = (id: string) => TIERS.find((t) => t.id === id)?.name ?? id;
  const deployed = POOL_ADDRESS !== zeroAddress;
  const lastLog = LOG[LOG.length - 1].d;

  return (
    <>
      <SilverDefs />

      {/* hero: copy on the left, the rig on a framed stage on the right, gauges as one strip */}
      <section className="deck-hero">
        <div className="deck-hero__copy">
          <p className="eyebrow"><span className="live">On shift now · {agents.length}</span> agents mining on Robinhood Chain</p>
          <h1 className="deck-hero__title">Mine with <span className="u-sheen">your agent.</span></h1>
          <p className="deck-hero__sub">
            Deploy an agent, send it on a 12-hour shift, and it mines ETH, {TOKEN_SYMBOL} or a tokenized stock for you every hour. You pick the machine it runs on. Your held tokens power it.
          </p>
          <div className="deck-hero__ctas">
            <a className="btn btn--lg" href={appLink("#create")}>Deploy your agent <span aria-hidden="true">→</span></a>
            <a className="btn ghost btn--lg" href="#board">See who&apos;s on shift</a>
          </div>
        </div>

        <div className="deck">
          <span className="deck__corner deck__corner--tl" aria-hidden="true" />
          <span className="deck__corner deck__corner--br" aria-hidden="true" />
          <div className="deck__rig">
            <RigFigure agents={agents.length} label="rig-01" />
          </div>
          <div className="deck__log" role="img" aria-label="Example agent log: online, machine and reward set, shift started, hourly earnings, claim ready">
            <div className="deck__cap"><span>agent.log</span><span>demo</span></div>
            <pre>
              {LOG.map((l) => (
                <span key={l.d} className={`ln ${l.cls ?? ""}`} style={{ animationDelay: `${l.d}ms` }}>{`> ${l.t}`}</span>
              ))}
              <span className="ln" style={{ animationDelay: `${lastLog + 500}ms` }}>{"> "}<span className="caret" /></span>
            </pre>
          </div>
        </div>
        <dl className="deck__gauges">
            <div><dt>Agents on shift</dt><dd>{agents.length}<small> / {stats?.deployed ?? 0}</small></dd><i style={{ ["--v" as string]: Math.min(1, agents.length / 50) }} /></div>
            <div><dt>Network hashrate</dt><dd>{totalHash.toString()}<small> H/s</small></dd><i style={{ ["--v" as string]: Math.min(1, Number(totalHash) / 2000) }} /></div>
            <div><dt>ETH in the pool</dt><dd>{fmt(eth?.balance ?? "0")}<small> ETH</small></dd><i style={{ ["--v" as string]: 1 }} /></div>
            <div><dt>Next payout in</dt><dd>{now ? hms(epochLeft) : "--:--:--"}</dd><i style={{ ["--v" as string]: now ? 1 - epochLeft / EPOCH_SECONDS : 0 }} /></div>
        </dl>
      </section>

      {/* 01 agent on shift: one 12-hour bar ---------------------------------------- */}
      <section className="block">
        <Bar n="01" label="Your agent, on shift" right="12h per shift" />
        <div className="block__body">
        <h2 className="block__title">Send it out. It works the shift. You bring home the haul.</h2>
        <div className="shift">
          <div className="shift__track" aria-hidden="true">
            {Array.from({ length: 13 }, (_, i) => <span key={i} className="shift__tick" style={{ left: `${(i / 12) * 100}%` }}><em>{i}h</em></span>)}
            <span className="shift__run" />
          </div>
          <ol className="shift__steps">
            {SHIFT.map((s, i) => (
              <li key={s.h} style={{ ["--at" as string]: s.at }}>
                <span className="shift__pin" aria-hidden="true" />
                <span className="label">Phase {pad(i + 1)}</span>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </li>
            ))}
          </ol>
        </div>
        </div>
      </section>

      {/* 02 machines: an option, not the story -------------------------------------- */}
      <section className="block">
        <Bar n="02" label="Pick its machine" />
        <div className="block__body block__body--split">
        <div>
          <h2 className="block__title">Every agent runs on a machine.</h2>
          <p className="block__lead">The machine is just a setting. A bigger one mines faster, and needs more held {TOKEN_SYMBOL} to switch on. If your balance dips, your agent drops to the machine it still covers.</p>
        </div>
        <div className="machines">
          {TIERS.map((t, i) => (
            <div key={t.id} className="machine" style={{ ["--p" as string]: Number(t.hashrate) / Number(TIERS[TIERS.length - 1].hashrate) }}>
              <ChipIcon size={28} />
              <div className="machine__id"><b>{t.name}</b><small>machine {pad(i + 1)}</small></div>
              <div className="machine__bar" aria-hidden="true"><i /></div>
              <div className="machine__spec"><b>{t.hashrate.toString()} H/s</b><small>hold {fmt(t.minHold)}</small></div>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* 03 the sorter: figure on the left, the five checks stacked beside it ---------- */}
      <section className="block" id="safeguards">
        <Bar n="03" label="The sorter" right={<span><i className="key key--ball" /> agent <i className="key key--wire" /> bot</span>} />
        <div className="block__body">
        <h2 className="block__title">Every hour, every agent goes through the sorter.</h2>
        <div className="sorter">
          <MachineFigure />
          <ol className="sorter__rules">
            {RULES.map((r, i) => (
              <li key={r.h}><span>{pad(i + 1)}</span><b>{r.h}</b><p>{r.p}</p></li>
            ))}
          </ol>
        </div>
        </div>
      </section>

      {/* 04 the haul: tanks across the top, one cell per pool beneath ----------------- */}
      <section className="block" id="pools">
        <Bar n="04" label="What it brings home" right={<span className="live">live</span>} />
        <div className="block__body">
        <h2 className="block__title">Five pools. Your agent mines the one you pick.</h2>
        <div className="bento">
          <div className="bento__tanks">
            <span className="bento__cap">pool levels</span>
            <TanksFigure pools={pools.map((p) => ({ symbol: p.symbol, balance: BigInt(p.balance) }))} />
          </div>
          {pools.map((p) => (
            <div key={p.address} className="bento__cell">
              <div className="bento__sym"><ChipIcon size={18} /> {p.symbol}</div>
              <b>{fmt(p.balance)}</b>
              <small>~{fmt(p.emissionPerHour)} / hour · {p.hashrate} H/s</small>
            </div>
          ))}
          <div className="bento__note">
            <p>Each pool releases <b>0.1% of itself every hour</b>, split between the agents mining it by machine × minutes on shift. Rewards are paid in the asset itself. No swap.</p>
            <p className="warn">Tokenized stocks are not available to US persons.</p>
          </div>
        </div>
        </div>
      </section>

      {/* 05 board -------------------------------------------------------------------- */}
      <section className="block" id="board">
        <Bar n="05" label="On shift now" right={`${agents.length} of ${stats?.deployed ?? 0}`} />
        <div className="block__body">
        <div className="block__row">
          <h2 className="block__title">Agents on the board.</h2>
          <a className="btn ghost" href={appLink("#leaderboard")}>Full leaderboard <span aria-hidden="true">→</span></a>
        </div>
        {agents.length === 0 ? (
          <div className="empty-board">
            <h3>No agent is on shift yet.</h3>
            <p>Deploy yours and it takes the first card on the board.</p>
            <a className="btn" href={appLink("#create")}>Deploy an agent</a>
          </div>
        ) : (
          <div className="board">
            {agents.map((a, i) => (
              <div key={a.address} className="rig" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="rig__top">
                  <AgentAvatar kind={a.avatar ?? "scout"} size={48} still />
                  <div className="rig__id"><b>{a.name}</b><span>{short(a.address)}</span></div>
                  <span className="live">on shift</span>
                </div>
                <div className="rig__stats">
                  <div><span className="label">Machine</span><b>{tierName(a.tier)}</b></div>
                  <div><span className="label">Rate</span><b>{a.hashrate} H/s</b></div>
                  <div><span className="label">Mines</span><b>{symbolOf(a.asset)}</b></div>
                </div>
                <div className="rig__foot">Shift ends in {now ? hms(Math.max(0, a.end - now)) : "…"}</div>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>

      {/* 06 spec sheet: contracts + hard limits -------------------------------------- */}
      <section className="block">
        <Bar n="06" label="Spec sheet" />
        <div className="block__body block__body--split">
        <div>
          <h2 className="block__title">What the contract enforces.</h2>
          <p className="block__lead">One contract holds every pool. No proxy, no upgrade path. If anything here and the contract disagree, the contract is right.</p>
        </div>
        <div className="spec">
          {[
            ["MiningPool", deployed ? <a href={EXPLORER + POOL_ADDRESS} target="_blank" rel="noreferrer">{short(POOL_ADDRESS)} ↗</a> : <Tag kind="planned">◇ not deployed</Tag>],
            [`${TOKEN_SYMBOL} token`, TOKEN_ADDRESS === "0x000000000000000000000000000000000000dead" ? <Tag kind="planned">◇ at launch</Tag> : <a href={EXPLORER + TOKEN_ADDRESS} target="_blank" rel="noreferrer">{short(TOKEN_ADDRESS)} ↗</a>],
            ["Payout per hour", "0.1% of each pool"],
            ["Payout cap", "5% of a pool per day"],
            ["Veto window", "30 minutes per payout root"],
            ["Shift length", `${SESSION_SECONDS / 3600} hours, then restart`],
            ["Withdraw", "unowed funds only · public · 48h lock"],
            ["Claim", "your own rewards, any time"],
          ].map(([k, v]) => (
            <div key={k as string} className="spec__row"><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
        </div>
      </section>

      {/* 07 roadmap ------------------------------------------------------------------ */}
      <section className="block" id="roadmap">
        <Bar n="07" label="Roadmap" />
        <div className="block__body">
          <ol className="road">
            {[
              ["done", "Contract, hourly job and app", "Tested end to end on a fork of the chain."],
              ["next", "Token launch", "Its address is published here."],
              ["next", "Mainnet pools", "MiningPool deploys; the first pools are funded."],
              ["later", "Builders API", "Agents, shifts and proofs, public."],
            ].map(([s, h, p]) => (
              <li key={h} className={`road--${s}`}>
                <span className="road__dot" aria-hidden="true" />
                <div><b>{h}</b><p>{p}</p></div>
                <Tag kind={s === "done" ? "open" : "planned"}>{s}</Tag>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 08 faq ---------------------------------------------------------------------- */}
      <section className="block">
        <Bar n="08" label="Questions" />
        <div className="block__body">
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="final">
        <span className="final__frame" aria-hidden="true" />
        <span className="final__n" aria-hidden="true">09</span>
        <h2>Your agent is waiting for its first shift.</h2>
        <a className="btn btn--lg" href={appLink("#create")}>Deploy your agent <span aria-hidden="true">→</span></a>
      </section>

      <footer className="foot">
        <span>Ultravein · Robinhood Chain 4663</span>
        <span>Tokenized stocks are not available to US persons.</span>
      </footer>
    </>
  );
}
