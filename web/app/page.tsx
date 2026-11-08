"use client";
import { useEffect, useState } from "react";
import { zeroAddress } from "viem";
import { EPOCH_SECONDS, POOL_ADDRESS, TIERS, TOKEN_ADDRESS, TOKEN_SYMBOL, appLink } from "@/lib/config";
import { fmt } from "@/lib/format";
import { ChipIcon, MachineFigure, RigFigure, SilverDefs, TanksFigure } from "./iso";

type Pool = { symbol: string; address: string; balance: string; committed: string; claimed: string; emissionPerHour: string; hashrate: string };
type Agent = { address: string; name: string; tier: string; asset: string; end: number; hashrate: string };
type Stats = { deployed: number; pools: Pool[]; agents: Agent[]; shop: { token: string | null; prices: string[] } };

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

// rig.log lines typed into the hero console; `d` is when each appears (ms)
const LOG: { t: string; cls?: string; d: number }[] = [
  { t: "rig vesper online", cls: "ok", d: 300 },
  { t: "vga      H100 · 120 H/s", cls: "dim", d: 900 },
  { t: "vein     NVDA", cls: "dim", d: 1300 },
  { t: "session  12h opened", d: 1900 },
  { t: "check    power held", cls: "dim", d: 2700 },
  { t: "yield    +0.0041 NVDA", cls: "ok", d: 3300 },
  { t: "check    power held", cls: "dim", d: 4300 },
  { t: "yield    +0.0039 NVDA", cls: "ok", d: 4900 },
  { t: "cashout  ready", d: 5800 },
];

const SHIFT = [
  { at: 0, h: "Deploy", p: "Name your rig, pick a VGA and the vein it mines. One signature." },
  { at: 0.08, h: "Power on", p: "Run node rig.mjs start in a terminal. It mines for as long as that stays open." },
  { at: 0.5, h: "Hourly yield", p: "Every hour it stays powered, it draws a cut of that pool." },
  { at: 1, h: "Cash out", p: "Claim the yield when you want, then power it on again." },
];

const RULES = [
  { h: "Owner-signed", p: "Your wallet signs each action exactly once. A replayed signature is turned away." },
  { h: "Lowest balance", p: "A held VGA counts only the lowest balance of the hour. A bought VGA skips this check." },
  { h: "Terminal on", p: "A VGA mines only while its terminal runs. Close it and the rig stops within 10 minutes." },
  { h: "No split bonus", p: "A bigger VGA never pays less per token, so spreading one bag across wallets never earns more." },
  { h: "Rate-limited", p: "No payout can take more than 5% of a pool per day, and each one can be vetoed for 30 minutes." },
];

const FAQ = [
  ["What does my VGA actually do?", "It holds your spot on a vein. For every hour its terminal stays on, it collects a share of the asset you chose."],
  ["Do I need real hardware?", "No. Every VGA is virtual and runs on the network. Hold enough to deploy one free, or buy one from us."],
  ["What does buying a VGA get me?", `That card for good, paid once in ${TOKEN_SYMBOL}. It mines without holding, an upgrade costs only the difference, and the whole price goes into the ${TOKEN_SYMBOL} reward pool.`],
  ["What costs gas?", "Claiming, and buying a VGA. Deploying one and linking its terminal are signatures."],
  ["Why a terminal?", "It is the machine switch. node rig.mjs start signs a heartbeat every 5 minutes with a key that holds no funds; stop it and your VGA stops. One wallet, one rig: extra terminals add nothing."],
  ["What happens if I sell while it runs?", "A held VGA steps down to the card your lowest balance in that hour covers. A bought VGA keeps running."],
  ["Can the team drain a pool?", "Only funds nobody has earned, through a public on-chain withdrawal that waits 48 hours."],
  ["My ETH claim disappeared. Why?", "Some wallets carry an EIP-7702 sweeper delegation that forwards any ETH they receive. Check yours before you claim."],
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
          <p className="eyebrow"><span className="live">On the vein now · {agents.length}</span> VGAs mining on Robinhood Chain</p>
          <h1 className="deck-hero__title">Your VGA,<br /> <span className="u-sheen">on the vein.</span></h1>
          <p className="deck-hero__sub">
            Deploy a VGA free with what you hold, or buy one from us and keep it for good. Link it to a terminal, run one command, and it mines ETH, {TOKEN_SYMBOL} or a tokenized stock out of the pool for every hour it stays on.
          </p>
          <div className="deck-hero__ctas">
            <a className="btn btn--lg" href={appLink("#create")}>Deploy your VGA <span aria-hidden="true">→</span></a>
            <a className="btn ghost btn--lg" href="#board">See who&apos;s mining</a>
          </div>
        </div>

        <div className="deck">
          <span className="deck__corner deck__corner--tl" aria-hidden="true" />
          <span className="deck__corner deck__corner--br" aria-hidden="true" />
          <div className="deck__rig">
            <RigFigure agents={agents.length} label="rig-01" />
          </div>
          <div className="deck__log" role="img" aria-label="Example rig log: online, machine and reward set, shift started, hourly earnings, claim ready">
            <div className="deck__cap"><span>rig.log</span><span>demo</span></div>
            <pre>
              {LOG.map((l) => (
                <span key={l.d} className={`ln ${l.cls ?? ""}`} style={{ animationDelay: `${l.d}ms` }}>{`> ${l.t}`}</span>
              ))}
              <span className="ln" style={{ animationDelay: `${lastLog + 500}ms` }}>{"> "}<span className="caret" /></span>
            </pre>
          </div>
        </div>
        <dl className="deck__gauges">
            <div><dt>VGAs mining</dt><dd>{agents.length}<small> / {stats?.deployed ?? 0}</small></dd><i style={{ ["--v" as string]: Math.min(1, agents.length / 50) }} /></div>
            <div><dt>Network hashrate</dt><dd>{totalHash.toString()}<small> H/s</small></dd><i style={{ ["--v" as string]: Math.min(1, Number(totalHash) / 2000) }} /></div>
            <div><dt>ETH in the pool</dt><dd>{fmt(eth?.balance ?? "0")}<small> ETH</small></dd><i style={{ ["--v" as string]: 1 }} /></div>
            <div><dt>Next payout in</dt><dd>{now ? hms(epochLeft) : "--:--:--"}</dd><i style={{ ["--v" as string]: now ? 1 - epochLeft / EPOCH_SECONDS : 0 }} /></div>
        </dl>
      </section>

      {/* 01 terminal to payout: one hour-by-hour bar ---------------------------------------- */}
      <section className="block">
        <Bar n="01" label="Terminal to payout" right="paid hourly" />
        <div className="block__body">
        <h2 className="block__title">One command switches it on. Every hour pays.</h2>
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
        <Bar n="02" label="Get a VGA" />
        <div className="block__body block__body--split">
        <div>
          <h2 className="block__title">Hold for one, or buy it for good.</h2>
          <p className="block__lead">Hold {TOKEN_SYMBOL} and the matching VGA deploys free, for as long as your balance stays put. Or buy a VGA from us once: it mines without holding, and its price goes straight into the {TOKEN_SYMBOL} reward pool.</p>
        </div>
        <div className="machines">
          {TIERS.map((t, i) => (
            <div key={t.id} className="machine" style={{ ["--p" as string]: Number(t.hashrate) / Number(TIERS[TIERS.length - 1].hashrate) }}>
              <ChipIcon size={28} />
              <div className="machine__id"><b>{t.name}</b><small>machine {pad(i + 1)}</small></div>
              <div className="machine__bar" aria-hidden="true"><i /></div>
              <div className="machine__spec">
                <b>{t.hashrate.toString()} H/s</b>
                <small>hold {fmt(t.minHold)} · {BigInt(stats?.shop?.prices[i] ?? "0") > 0n ? `or buy ${fmt(stats!.shop.prices[i])}` : "buy at launch"}</small>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* 03 the sorter: figure on the left, the five checks stacked beside it ---------- */}
      <section className="block" id="safeguards">
        <Bar n="03" label="The filter" right={<span><i className="key key--ball" /> rig <i className="key key--wire" /> bot</span>} />
        <div className="block__body">
        <h2 className="block__title">Each hour, every rig passes the filter.</h2>
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
        <Bar n="04" label="The yield" right={<span className="live">live</span>} />
        <div className="block__body">
        <h2 className="block__title">Five veins. Your VGA taps the one you choose.</h2>
        <div className="bento">
          <div className="bento__tanks">
            <span className="bento__cap">pool levels</span>
            {/* before stats load (or with no pool deployed) draw the five tanks empty, not a blank panel */}
            <TanksFigure pools={pools.length ? pools.map((p) => ({ symbol: p.symbol, balance: BigInt(p.balance) })) : ["ETH", TOKEN_SYMBOL, "MSFT", "AAPL", "NVDA"].map((symbol) => ({ symbol, balance: 0n }))} />
          </div>
          {pools.map((p) => (
            <div key={p.address} className="bento__cell">
              <div className="bento__sym"><ChipIcon size={18} /> {p.symbol}</div>
              <b>{fmt(p.balance)}</b>
              <small>~{fmt(p.emissionPerHour)} / hour · {p.hashrate} H/s</small>
            </div>
          ))}
          <div className="bento__note">
            <p>Every hour each pool lets out <b>0.1% of its balance</b>, divided among the VGAs tapping it by hashrate × minutes worked. You are paid in that asset, never swapped.</p>
            <p className="warn">Tokenized stocks are not available to US persons.</p>
          </div>
        </div>
        </div>
      </section>

      {/* 05 board -------------------------------------------------------------------- */}
      <section className="block" id="board">
        <Bar n="05" label="Mining now" right={`${agents.length} of ${stats?.deployed ?? 0}`} />
        <div className="block__body">
        <div className="block__row">
          <h2 className="block__title">Who&apos;s on the vein.</h2>
          <a className="btn ghost" href={appLink("#leaderboard")}>Full leaderboard <span aria-hidden="true">→</span></a>
        </div>
        {agents.length === 0 ? (
          <div className="empty-board">
            <h3>The vein is quiet for now.</h3>
            <p>Deploy your VGA and it claims the first spot.</p>
            <a className="btn" href={appLink("#create")}>Deploy a VGA</a>
          </div>
        ) : (
          <div className="board">
            {agents.map((a, i) => (
              <div key={a.address} className="rig" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="rig__top">
                  <ChipIcon size={36} />
                  <div className="rig__id"><b>{a.name}</b><span>{short(a.address)}</span></div>
                  <span className="live">digging</span>
                </div>
                <div className="rig__stats">
                  <div><span className="label">Machine</span><b>{tierName(a.tier)}</b></div>
                  <div><span className="label">Rate</span><b>{a.hashrate} H/s</b></div>
                  <div><span className="label">Mines</span><b>{symbolOf(a.asset)}</b></div>
                </div>
                <div className="rig__foot">Dig ends in {now ? hms(Math.max(0, a.end - now)) : "…"}</div>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>

      {/* 06 spec sheet: contracts + hard limits -------------------------------------- */}
      <section className="block">
        <Bar n="06" label="Contract terms" />
        <div className="block__body block__body--split">
        <div>
          <h2 className="block__title">Rules the contract holds.</h2>
          <p className="block__lead">A single contract holds every pool, with no proxy and no upgrade path. Where this page and the contract differ, the contract wins.</p>
        </div>
        <div className="spec">
          {[
            ["MiningPool", deployed ? <a href={EXPLORER + POOL_ADDRESS} target="_blank" rel="noreferrer">{short(POOL_ADDRESS)} ↗</a> : <Tag kind="planned">◇ not deployed</Tag>],
            [`${TOKEN_SYMBOL} token`, TOKEN_ADDRESS === "0x000000000000000000000000000000000000dead" ? <Tag kind="planned">◇ at launch</Tag> : <a href={EXPLORER + TOKEN_ADDRESS} target="_blank" rel="noreferrer">{short(TOKEN_ADDRESS)} ↗</a>],
            ["Payout per hour", "0.1% of each pool"],
            ["Payout cap", "5% of a pool per day"],
            ["Veto window", "30 minutes per payout root"],
            ["Heartbeat", "every 5 min from the terminal; a rig stops 10 min after the last one"],
            ["VGA shop", `bought once in ${TOKEN_SYMBOL}, kept for good, price paid into the pool`],
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
              ["done", "Contract, hourly settlement and app", "Run end to end against a fork of the chain."],
              ["next", "Token goes live", "Its address lands on this page."],
              ["next", "Veins open on mainnet", "MiningPool deploys and the first pools get funded."],
              ["next", "VGA shop opens", "Buy a VGA with the token once it launches."],
              ["later", "Open builder API", "Rigs, sessions and proofs, readable by anyone."],
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
        <h2>The vein is open. Your VGA isn&apos;t on it yet.</h2>
        <a className="btn btn--lg" href={appLink("#create")}>Deploy your VGA <span aria-hidden="true">→</span></a>
      </section>

      <footer className="foot">
        <span>Ultravein · Robinhood Chain 4663</span>
        <span>Tokenized stocks are not available to US persons.</span>
      </footer>
    </>
  );
}
