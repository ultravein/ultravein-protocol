"use client";
import { useEffect, useMemo, useState } from "react";
import { zeroAddress } from "viem";
import {
  ASSETS,
  CHALLENGE_DELAY,
  EMISSION_PPM,
  EPOCH_SECONDS,
  MAX_EPOCHS_PER_RUN,
  POOL_ADDRESS,
  SESSION_SECONDS,
  TIERS,
  TOKEN_SYMBOL,
} from "@/lib/config";
import { fmt } from "@/lib/format";
import { appLink } from "@/lib/config";
import { MAX_SKEW_SECONDS } from "@/lib/auth";

const REV = "rev 2026.10";
const PCT_PER_HOUR = Number(EMISSION_PPM) / 10_000; // 1000 ppm = 0.1%
const SESSION_H = SESSION_SECONDS / 3600;
const VETO_MIN = CHALLENGE_DELAY / 60;

// --- small building blocks ---------------------------------------------------------

function Code({ children, lang = "" }: { children: string; lang?: string }) {
  const [done, setDone] = useState(false);
  const copy = () =>
    navigator.clipboard
      ?.writeText(children)
      .then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      })
      .catch(() => {});
  return (
    <div className="mcode">
      <div className="mcode__bar">
        <span>{lang || "text"}</span>
        <button onClick={copy} aria-label="Copy code">{done ? "copied" : "copy"}</button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function Note({ kind = "note", children }: { kind?: "note" | "warn" | "rule"; children: React.ReactNode }) {
  return (
    <div className={`mnote mnote--${kind}`}>
      <span className="mnote__k">{kind === "warn" ? "WARN" : kind === "rule" ? "RULE" : "NOTE"}</span>
      <div>{children}</div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mtable">
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// --- the manual --------------------------------------------------------------------

type Chapter = { id: string; title: string; summary: string; keys: string; body: React.ReactNode };

const tierRows = TIERS.map((t, i) => [
  `machine ${String(i + 1).padStart(2, "0")}`,
  <b key="n">{t.name}</b>,
  `${fmt(t.minHold)} ${TOKEN_SYMBOL}`,
  `${t.hashrate} H/s`,
  (Number(t.hashrate) / (Number(t.minHold / 10n ** 18n) / 1e6)).toFixed(1),
]);

const CHAPTERS: Chapter[] = [
  {
    id: "overview",
    title: "The short version",
    summary: "Ultravein on one page.",
    keys: "intro what vga mining pool robinhood",
    body: (
      <>
        <p className="mlead">Ultravein lets every holder <b>put a VGA on the vein</b>. Deploy one free with what you hold, or buy one from us for good, then run it in {SESSION_H}-hour sessions. Every hour it stays powered it draws a share of the pool you chose: ETH, {TOKEN_SYMBOL}, or a tokenized stock.</p>
        <p>No hardware involved: every VGA is virtual. Bigger VGAs mine faster; a held one needs more {TOKEN_SYMBOL} to power on, a bought one needs none.</p>
        <Table
          head={["Part", "What it is"]}
          rows={[
            ["Rig", "Your miner. One per wallet, with a name, a VGA and a reward vein."],
            ["Shift", `A ${SESSION_H}-hour run. Start it with a signature, restart it when it ends.`],
            ["VGA", "The card your rig runs, held (unlocked by balance) or bought (yours for good)."],
            ["Pool", "One bucket per reward asset, funded by the project."],
            ["Epoch", `${EPOCH_SECONDS / 60} minutes. Rewards are measured and settled per epoch.`],
            ["MiningPool", "The one contract that holds every pool and pays claims."],
          ]}
        />
        <Note>Everything you do is a signature except the claim, which is the only transaction and the only gas you pay.</Note>
      </>
    ),
  },
  {
    id: "quickstart",
    title: "First dig",
    summary: "From wallet to payout in five moves.",
    keys: "start begin how setup first steps",
    body: (
      <>
        <ol className="msteps">
          <li><b>Hold {TOKEN_SYMBOL}.</b> At least {fmt(TIERS[0].minHold)} for the smallest machine.</li>
          <li><b>Connect your wallet</b> from the header. The site never sends anything without your confirmation.</li>
          <li><b>Deploy a VGA</b> in the dashboard: pick a VGA (or buy one), a name and a reward. Sign once.</li>
          <li><b>Start a shift</b> from Overview or Machine. Sign once more. Your VGA mines for {SESSION_H} hours.</li>
          <li><b>Claim</b> from Portfolio once a payout root has passed its {VETO_MIN}-minute window.</li>
        </ol>
        <Note kind="warn">Tokenized stocks are not available to US persons.</Note>
      </>
    ),
  },
  {
    id: "vgas",
    title: "VGAs & the shop",
    summary: "Hold for one free, or buy one for good.",
    keys: "vga gpu card buy shop own hold deploy rig tier price upgrade",
    body: (
      <>
        <p>Each wallet runs one rig with one VGA. Every VGA is virtual: there is no hardware to plug in. There are two ways to get one.</p>
        <Table
          head={["Route", "How it works"]}
          rows={[
            ["Deploy (hold)", `Free. Hold ${TOKEN_SYMBOL} and the VGA your balance covers is yours to run, checked every hour against your lowest balance.`],
            ["Buy (own)", `Pay once in ${TOKEN_SYMBOL} through MiningPool.buyCard. The VGA is yours for good and mines with no holding at all.`],
          ]}
        />
        <ul className="mlist">
          <li>Upgrading a bought VGA costs only the difference over what this wallet already paid.</li>
          <li>The whole price lands in the {TOKEN_SYMBOL} reward pool and is paid back out to miners like any refill.</li>
          <li>Your rig runs the best VGA you can power, owned or held, and never one above the VGA you picked.</li>
        </ul>
        <Table
          head={["Field", "Rule"]}
          rows={[
            ["Name", "1 to 32 bytes, no leading or trailing spaces, no control characters."],
            ["VGA", TIERS.map((t) => t.name).join(", ")],
            ["Reward", ASSETS.map((a) => a.symbol).join(", ")],
          ]}
        />
        <Note kind="rule">Saving your rig again updates it; the change applies from your next session.</Note>
      </>
    ),
  },
  {
    id: "shifts",
    title: "Digs (shifts)",
    summary: `${SESSION_H} hours on the vein, then clock in again.`,
    keys: "shift session start restart 12h idle",
    body: (
      <>
        <p>A shift starts the moment your signature is accepted and ends exactly {SESSION_H} hours later. The machine and reward are frozen for that shift.</p>
        <ul className="mlist">
          <li>A new shift can start only when none is running.</li>
          <li>Starting needs at least {fmt(TIERS[0].minHold)} {TOKEN_SYMBOL} in the wallet at that moment.</li>
          <li>Seconds count: a shift that covers 20 minutes of an epoch earns for 20 minutes of it.</li>
          <li>An idle rig earns nothing. That is the point: abandoned rigs stop drawing from the pool.</li>
        </ul>
      </>
    ),
  },
  {
    id: "machines",
    title: "Rigs (machines)",
    summary: "Your rate, unlocked by what you hold.",
    keys: "machine gpu tier hashrate rtx a100 h100 hold",
    body: (
      <>
        <Table head={["Slot", "Machine", "Hold at least", "Hashrate", "H/s per 1M held"]} rows={tierRows} />
        <Note kind="rule">Bigger machines never pay less per token than smaller ones (the last column never drops). Splitting one bag across many wallets can therefore never earn more than holding it in one.</Note>
        <p>The VGA your rig actually runs in an epoch is the <b>largest one you bought or your lowest balance in that epoch covers</b>, and never larger than the one you picked.</p>
        <Code lang="example">{`picked      H100  (needs 10,000,000)
lowest bal  2,300,000 during the hour
runs as     RTX 4090 · 10 H/s for that hour`}</Code>
      </>
    ),
  },
  {
    id: "holding",
    title: "The stake check",
    summary: "Your lowest balance in the hour sets the rate.",
    keys: "balance hold minimum dip transfer logs flash",
    body: (
      <>
        <p>Every epoch the network reads every {TOKEN_SYMBOL} Transfer that touched your wallet and walks your balance back through the hour. The <b>lowest</b> point it finds sets your machine for that epoch.</p>
        <ul className="mlist">
          <li>Buying just before the hour ends does not help: the balance at the start of the hour counts too.</li>
          <li>Selling and buying back inside the hour counts as the dip.</li>
          <li>Below the smallest machine, that epoch earns nothing, but the shift keeps running.</li>
        </ul>
        <Note>Robinhood Chain RPCs keep only minutes of historical state, so balances are rebuilt from Transfer logs rather than read at old blocks.</Note>
      </>
    ),
  },
  {
    id: "rewards",
    title: "Veins & yield",
    summary: `Each pool lets out ${PCT_PER_HOUR}% of itself per hour.`,
    keys: "reward emission formula share pool eth stock nvda aapl msft",
    body: (
      <>
        <p>There is one pool per reward asset. Your VGA mines only the pool you picked, and is paid in that asset. No swap is involved.</p>
        <Code lang="formula">{`released(pool, epoch) = remaining(pool) × ${PCT_PER_HOUR}%
remaining(pool)        = balance − (allocated − claimed)

weight(rig)            = hashrate(VGA) × seconds on session in the epoch
share(rig)             = released × weight / Σ weight of rigs on this pool`}</Code>
        <p>Every share is rounded down, so a pool never releases more than its {PCT_PER_HOUR}%. A pool with nobody mining it releases nothing that hour.</p>
        <Code lang="worked example">{`ETH pool holds 10 ETH            → releases 0.01 ETH this hour
rig A: H100   (120 H/s) × 3600 s  → weight 432,000
rig B: A100   ( 55 H/s) × 1800 s  → weight  99,000
A earns 0.01 × 432,000 / 531,000 = 0.008135 ETH
B earns 0.01 ×  99,000 / 531,000 = 0.001864 ETH`}</Code>
        <p>Because the release is a share of what is left, a pool never runs dry on its own; refills make the next hours pay more.</p>
      </>
    ),
  },
  {
    id: "settlement",
    title: "Hourly settlement",
    summary: "A root each hour, a veto window, a hard cap.",
    keys: "settlement merkle root veto guardian publisher cap epoch",
    body: (
      <>
        <p>An hourly job measures each finished epoch, adds the results to every wallet's running total, and publishes a Merkle root of those totals to MiningPool.</p>
        <Table
          head={["Step", "What happens"]}
          rows={[
            ["Measure", "Holding check, VGA, seconds and shares for every rig on a session."],
            ["Accumulate", "Totals are cumulative per (wallet, asset), so a missed run loses nothing."],
            ["Publish", "The publisher key submits the root and the new total per asset."],
            ["Veto window", `${VETO_MIN} minutes in which the guardian key can discard the root.`],
            ["Active", "After the window, claims use the new root."],
          ]}
        />
        <Note kind="rule">A root can commit at most 5% of a pool's unallocated balance per day elapsed since the previous root. Even a wrong or stolen publisher key cannot drain a pool.</Note>
        <p>If the job is down, up to {MAX_EPOCHS_PER_RUN} missed epochs are processed on its next run, oldest first.</p>
      </>
    ),
  },
  {
    id: "claiming",
    title: "Cashing out",
    summary: "Your yield, whenever you want, in one transaction.",
    keys: "claim proof gas wallet blocked paused 7702 sweeper",
    body: (
      <>
        <p>Portfolio shows, per asset, what you earned, what you already claimed and what is claimable now. Claiming sends one transaction that proves your total and pays the difference since your last claim.</p>
        <ul className="mlist">
          <li>Claimable trails earned by up to one settlement plus its {VETO_MIN}-minute window.</li>
          <li>Only your own wallet can claim for itself.</li>
          <li>A stock issuer can block a wallet or pause its market. That claim reverts, nothing moves, and the reward stays claimable.</li>
        </ul>
        <Note kind="warn">Some wallets carry an EIP-7702 sweeper delegation that forwards any ETH they receive. If your wallet's code starts with <code>0xef0100</code> and you did not set it, an ETH claim will be swept. Use a clean wallet.</Note>
      </>
    ),
  },
  {
    id: "safety",
    title: "Guarantees",
    summary: "What the contract guarantees, and what it cannot.",
    keys: "safety trust withdraw timelock owner upgrade proxy rug",
    body: (
      <>
        <Table
          head={["Enforced by the contract", "Depends on a key or a service"]}
          rows={[
            ["Claims can never exceed what a root commits.", "The publisher computing shares honestly."],
            ["5% per day cap on every root.", "The guardian vetoing a bad root in time."],
            [`${VETO_MIN}-minute veto window on every root.`, "The hourly job running."],
            ["Withdraws only of unowed funds, public, after 48 hours.", "The owner key not being lost."],
            ["No proxy, no upgrade path.", "Robinhood Chain's sequencer and its own upgradeable core."],
          ]}
        />
        <p>The owner can list reward assets, rotate the publisher and guardian, and propose a withdraw. A withdraw is an on-chain event that cannot execute for 48 hours and can never touch what is owed to miners.</p>
      </>
    ),
  },
  {
    id: "contract",
    title: "Contract reference",
    summary: "MiningPool's functions, events and errors.",
    keys: "contract solidity function event error abi miningpool address",
    body: (
      <>
        <Table
          head={["Item", "Value"]}
          rows={[
            ["MiningPool", POOL_ADDRESS === zeroAddress ? "not deployed yet" : <code key="p">{POOL_ADDRESS}</code>],
            ["Chain", "Robinhood Chain · id 4663"],
            ["RELEASE_BPS_PER_DAY", "500 (5%)"],
            ["CHALLENGE_DELAY", `${CHALLENGE_DELAY} s`],
            ["WITHDRAW_DELAY", "172800 s (48 h)"],
            ["Leaf", "keccak256(keccak256(abi.encode(account, asset, cumulative)))"],
          ]}
        />
        <Code lang="solidity">{`function fund(address asset, uint256 amount) payable
function claim(address asset, uint256 cumulative, bytes32[] proof)
function buyCard(uint8 tier)                                               // VGA shop, pays the difference
function setShop(address token, uint256[] prices)                          // owner, prices[i] = tier i+1
function publish(bytes32 root, address[] assets, uint256[] newCommitted)   // publisher
function veto()                                                            // guardian
function promote()                                                         // anyone
function proposeWithdraw(address asset, uint256 amount, address to)        // owner
function executeWithdraw(uint256 id) / cancelWithdraw(uint256 id)          // owner
function setAsset(address asset, bool allowed) / setRoles(owner, publisher, guardian)

view root() · pendingRoot() · committed(asset) · claimed(asset)
     claimedBy(account, asset) · unallocated(asset) · allowed(asset)
     cardToken() · cardPrice(tier) · cardOf(account) · cardSpent(account)`}</Code>
        <Code lang="events / errors">{`event Funded(from, asset, amount)       event Claimed(account, asset, amount)
event Published(root, assets, totals)  event Promoted(root)   event Vetoed(root)
event WithdrawProposed(id, asset, amount, to, readyAt)  WithdrawCancelled  WithdrawExecuted
event ShopSet(token, prices)           event CardBought(buyer, tier, paid)

error OverCap(asset)  BadProof  NothingToClaim  OverCommitted  PendingExists
      NotAllowed  BadInput  NothingToVeto  NotReady  OverUnallocated  Unauthorized`}</Code>
        <p>ETH is <code>address(0)</code>. Asset arrays in <code>publish</code> must be strictly ascending.</p>
      </>
    ),
  },
  {
    id: "api",
    title: "API reference",
    summary: "Each public endpoint and what it returns.",
    keys: "api endpoint json rest stats me proof history network rig session",
    body: (
      <>
        <Table
          head={["Method", "Path", "Returns"]}
          rows={[
            ["GET", <code key="1">/api/stats</code>, "deployed, shop{token, prices[]}, pools[], agents[] (rigs on a session)"],
            ["GET", <code key="2">/api/network</code>, "net[]: per epoch rigs, hashrate, pools, emitted"],
            ["GET", <code key="3">/api/me?address=</code>, "agent (your rig), session, balance, effectiveTier, owned, perHour, earned, wallet"],
            ["GET", <code key="4">/api/history?address=</code>, "hist[] per epoch, act[] activity log"],
            ["GET", <code key="5">/api/proof?address=&asset=</code>, "cumulative, claimable, proof[]"],
            ["POST", <code key="6">/api/agent</code>, "deploy or update your rig (signed)"],
            ["POST", <code key="7">/api/session</code>, "start a shift (signed)"],
          ]}
        />
        <Code lang="GET /api/proof">{`{
  "cumulative": "8135000000000000",
  "claimable":  "8135000000000000",
  "proof": ["0x5f2a…", "0x91c0…"]
}`}</Code>
        <p>Amounts are decimal strings in the asset's smallest unit (18 decimals for every listed asset). Addresses are lowercase.</p>
      </>
    ),
  },
  {
    id: "messages",
    title: "Signed messages",
    summary: "Word for word, what your wallet signs.",
    keys: "signature message sign replay timestamp eip191",
    body: (
      <>
        <p>Both actions are plain personal-sign messages. Every field is inside the text, so none can be swapped after signing.</p>
        <Code lang="rig">{`ultravein rig
address: 0xyouraddress
name: nightshift
tier: h100
asset: 0x0000000000000000000000000000000000000000
ts: 1791395618`}</Code>
        <Code lang="session">{`ultravein session
address: 0xyouraddress
ts: 1791395619`}</Code>
        <Note kind="rule">ts must be within {MAX_SKEW_SECONDS / 60} minutes of the server clock and newer than the last accepted ts for your wallet. A replayed or stale signature is refused. Contract wallets are checked with ERC-1271.</Note>
      </>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard guide",
    summary: "A tour of every tab.",
    keys: "dashboard app overview portfolio activity leaderboard tab",
    body: (
      <Table
        head={["Tab", "Use it to"]}
        rows={[
          ["Overview", "Your VGA in 3D, balance, estimated rate, earnings chart and the 12-hour blocks."],
          ["Deploy VGA", "Pick or buy a VGA, name your rig, choose a reward. Preview the board card."],
          ["Machine", "Start a shift, watch progress, see which gate checks pass."],
          ["Activity", "Minutes mined per hour, a timeline and a table of every epoch."],
          ["Portfolio", "Wallet balances, earned, claimed, claimable and claim buttons per asset."],
          ["Pools", "Pool levels, buckets, your share, network hashrate and pool history."],
          ["Leaderboard", "Every rig on a session, strongest VGA first."],
        ]}
      />
    ),
  },
  {
    id: "faq",
    title: "FAQ",
    summary: "Quick answers.",
    keys: "faq question answer",
    body: (
      <div className="mfaq">
        {[
          ["Do I need a GPU?", "No. The machine is a setting; your held balance unlocks it."],
          ["Can I run two VGAs?", "One wallet runs one rig. More wallets never beat one bag, by design."],
          ["Why is claimable lower than earned?", `Claimable follows the active root, which trails by up to one settlement plus ${VETO_MIN} minutes.`],
          ["What if the hourly job stops?", `Nothing is lost. Totals are cumulative and up to ${MAX_EPOCHS_PER_RUN} epochs catch up per run.`],
          ["Is the APR fixed?", "No rate is promised. It depends on pool size, refills and how many VGAs mine it."],
          ["What happens to idle pools?", "A pool nobody mines releases nothing and keeps its balance."],
        ].map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </div>
    ),
  },
  {
    id: "glossary",
    title: "Glossary",
    summary: "The vocabulary of the site and the API.",
    keys: "glossary terms definition words",
    body: (
      <dl className="mgloss">
        {[
          ["Rig", "Your miner; one per wallet."],
          ["Shift", `A ${SESSION_H}-hour mining session.`],
          ["VGA", "The hashrate tier your rig runs, held or bought."],
          ["Epoch", `A ${EPOCH_SECONDS / 60}-minute window; rewards are measured per epoch.`],
          ["Weight", "Hashrate × seconds on shift within an epoch."],
          ["Root", "Merkle root of every wallet's cumulative rewards."],
          ["Committed", "What the active root says miners are owed, per asset."],
          ["Unallocated", "Pool balance not owed to anyone."],
          ["Publisher", "The key that posts roots."],
          ["Guardian", "The key that can veto a root during its window."],
        ].map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    ),
  },
];

export default function Docs() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(CHAPTERS[0].id);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? CHAPTERS.filter((c) => `${c.title} ${c.summary} ${c.keys}`.toLowerCase().includes(s)) : CHAPTERS;
  }, [q]);

  // highlight the chapter being read
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    shown.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [shown]);

  return (
    <div className="manual">
      <header className="manual__cover">
        <span className="manual__stamp">FIELD MANUAL · {REV}</span>
        <h1>Inside Ultravein, from rig to payout.</h1>
        <p>How a VGA taps a vein, how holding or buying sets its rate, how each hour is settled, and the exact contract, API and signed messages underneath.</p>
        <label className="manual__search">
          <span aria-hidden="true">/</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter chapters: claim, machine, api…" aria-label="Filter chapters" />
          {q && <button onClick={() => setQ("")} aria-label="Clear filter">clear</button>}
        </label>
      </header>

      <div className="manual__body">
        <nav className="manual__index" aria-label="Chapters">
          <span className="label">Index · {shown.length}/{CHAPTERS.length}</span>
          <ol>
            {shown.map((c) => {
              const n = String(CHAPTERS.indexOf(c) + 1).padStart(2, "0");
              return (
                <li key={c.id}>
                  <a href={`#${c.id}`} className={active === c.id ? "is-on" : ""}>
                    <span>[{n}]</span>
                    {c.title}
                  </a>
                </li>
              );
            })}
          </ol>
          <a className="btn btn--block" href={appLink("#create")}>Deploy your VGA <span aria-hidden="true">→</span></a>
        </nav>

        <div className="manual__pages">
          {shown.length === 0 && <p className="muted">No chapter matches “{q}”.</p>}
          {shown.map((c) => {
            const n = String(CHAPTERS.indexOf(c) + 1).padStart(2, "0");
            return (
              <article key={c.id} id={c.id} className="mpage">
                <div className="mpage__strip">
                  <span>MANUAL / {n} · {c.title.toUpperCase()}</span>
                  <span>{REV}</span>
                </div>
                <h2>{c.title}</h2>
                <p className="mpage__sum">{c.summary}</p>
                <div className="mpage__body">{c.body}</div>
              </article>
            );
          })}
          <p className="fine">If anything in this manual and the MiningPool contract ever disagree, the contract is right.</p>
        </div>
      </div>
    </div>
  );
}
