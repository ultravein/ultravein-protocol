"use client";
// Ultravein's own figures: a GPU rig, a sieve and pool tanks, in brushed silver.
// Motion uses SMIL so it runs off the main thread; it is dropped for reduced motion.
import { useEffect, useState } from "react";

type V = [number, number, number];
// Asymmetric 3/4 camera (dimetric): x runs 20deg below horizontal, y runs 40deg the other way and
// slightly foreshortened, so the front faces read wider than the sides. Every plane matrix below
// is built from these two axes, so changing them re-angles every figure at once.
const AX: [number, number] = [0.94, 0.342];
const AY: [number, number] = [-0.651, 0.546];
const xy = ([x, y, z]: V): [number, number] => [+(x * AX[0] + y * AY[0]).toFixed(2), +(x * AX[1] + y * AY[1] - z).toFixed(2)];
const TOP_M = `${AX[0]} ${AX[1]} ${AY[0]} ${AY[1]}`; // flat drawing laid on a top plane
const FRONT_M = `${AX[0]} ${AX[1]} 0 -1`; // plane y = const
const SIDE_M = `${AY[0]} ${AY[1]} 0 -1`; // plane x = const
const poly = (pts: V[]) => pts.map((v) => xy(v).join(",")).join(" ");

function useMotion() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setOk(!q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);
  return ok;
}

/** Shared gradients; render once per page. */
export function SilverDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="g-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ddd3f6" />
        </linearGradient>
        <linearGradient id="g-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9b8f2" />
          <stop offset="1" stopColor="#9b80e0" />
        </linearGradient>
        <linearGradient id="g-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b6fd6" />
          <stop offset="1" stopColor="#5b3fb0" />
        </linearGradient>
        <linearGradient id="g-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b21b6" />
          <stop offset=".35" stopColor="#8b5cf6" />
          <stop offset=".6" stopColor="#c4b5fd" />
          <stop offset=".8" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id="g-liquid" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset=".45" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <pattern id="g-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V4" stroke="#4c1d95" strokeOpacity=".45" />
        </pattern>
        <radialGradient id="g-ball" cx=".35" cy=".35">
          <stop offset="0" stopColor="#ddd6fe" />
          <stop offset="1" stopColor="#6d28d9" />
        </radialGradient>
        <radialGradient id="g-glow">
          <stop offset="0" stopColor="#a78bfa" stopOpacity=".22" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** A solid box with its three visible faces (larger x + y is closer to the viewer). */
function Box({ at: [x, y, z], size: [w, d, h], wire, hatch }: { at: V; size: V; wire?: boolean; hatch?: boolean }) {
  const top: V[] = [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]];
  const right: V[] = [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]];
  const left: V[] = [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]];
  if (wire)
    return (
      <g fill={hatch ? "url(#g-hatch)" : "none"} stroke="#2e1065" strokeOpacity=".75" strokeWidth=".8" strokeDasharray="3 2" strokeLinejoin="round">
        <polygon points={poly(top)} />
        <polygon points={poly(right)} />
        <polygon points={poly(left)} />
      </g>
    );
  return (
    <g stroke="#2e1065" strokeOpacity=".65" strokeWidth=".8" strokeLinejoin="round">
      <polygon points={poly(left)} fill="url(#g-left)" />
      <polygon points={poly(right)} fill="url(#g-right)" />
      <polygon points={poly(top)} fill="url(#g-top)" />
    </g>
  );
}

/** GPU die with pins: the icon used in lists, steps and timelines. */
export function ChipIcon({ size = 26, dim }: { size?: number; dim?: boolean }) {
  const pins = [5, 9, 13, 17];
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" className="cube-icon" opacity={dim ? 0.45 : 1}>
      <g stroke="#4c1d95" strokeWidth="1.2" strokeLinecap="round">
        {pins.map((p) => (
          <g key={p}>
            <line x1={p} y1="1" x2={p} y2="3.5" />
            <line x1={p} y1="18.5" x2={p} y2="21" />
            <line x1="1" y1={p} x2="3.5" y2={p} />
            <line x1="18.5" y1={p} x2="21" y2={p} />
          </g>
        ))}
      </g>
      <rect x="3.5" y="3.5" width="15" height="15" rx="1.5" fill="url(#g-left)" stroke="#2e1065" strokeOpacity=".7" strokeWidth=".8" />
      <rect x="7" y="7" width="8" height="8" rx=".8" fill="url(#g-top)" />
    </svg>
  );
}

// --- FIG. 1: the rig ----------------------------------------------------------------

/** One fan drawn flat, then laid onto the card's top plane with an isometric matrix. */
function Fan({ c, r, spin }: { c: V; r: number; spin: number | null }) {
  const [X, Y] = xy(c);
  const blades = Array.from({ length: 9 }, (_, i) => i * 40);
  return (
    <g transform={`matrix(${TOP_M} ${X} ${Y})`}>
      <circle r={r + 3} fill="#1e1534" stroke="url(#g-sheen)" strokeWidth="1.4" />
      <g>
        {blades.map((a) => (
          <path key={a} d={`M0 0 Q ${r * 0.55} ${-r * 0.2} ${r * 0.92} ${r * 0.18} L ${r * 0.62} ${r * 0.42} Z`} transform={`rotate(${a})`} fill="url(#g-left)" stroke="#4c1d95" strokeOpacity=".55" strokeWidth=".6" />
        ))}
        {spin && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={`${spin}s`} repeatCount="indefinite" />}
      </g>
      <circle r={r * 0.24} fill="url(#g-top)" stroke="#2e1065" strokeOpacity=".7" strokeWidth=".6" />
    </g>
  );
}

/** A silver graphics card. Fans spin faster as more agents mine. */
export function RigFigure({ agents, idle, label = "ultravein-01" }: { agents: number; idle?: boolean; label?: string }) {
  const motion = useMotion() && !idle;
  const spin = motion ? Math.max(0.5, 3.2 - agents * 0.25) : null;
  const L = 240, D = 96;
  const grid = [];
  for (let i = -40; i <= L + 40; i += 20) grid.push([[i, -40, 0], [i, D + 40, 0]] as [V, V]);
  for (let j = -40; j <= D + 40; j += 20) grid.push([[-40, j, 0], [L + 40, j, 0]] as [V, V]);
  const fans: V[] = [[48, D / 2, 30], [120, D / 2, 30], [192, D / 2, 30]];
  // LED strip along the front edge of the shroud
  const ledA = xy([4, D - 4, 25]);
  const ledB = xy([L - 4, D - 4, 25]);
  return (
    <svg viewBox="-112 -66 364 216" className="fig-svg" role="img" aria-label={`A graphics card with three fans. ${agents} agents mining.`}>
      <ellipse cx="70" cy="48" rx="200" ry="100" fill="url(#g-glow)" />
      <g stroke="#4c1d95" strokeOpacity=".09">
        {grid.map(([a, b], i) => {
          const [x1, y1] = xy(a), [x2, y2] = xy(b);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      {/* PCB, shroud, backplate rail */}
      <Box at={[0, 0, 0]} size={[L, D, 8]} />
      <Box at={[-10, 0, 0]} size={[10, D, 34]} />
      <Box at={[4, 4, 8]} size={[L - 8, D - 8, 18]} />
      {/* edge connector fingers on the PCB's front face */}
      {Array.from({ length: 18 }, (_, i) => {
        const [x, y] = xy([60 + i * 6, D, 1]);
        return <rect key={i} x={x - 1.2} y={y - 5} width="2.4" height="5" fill="#4c1d95" opacity=".55" />;
      })}
      {fans.map((c, i) => <Fan key={i} c={c} r={30} spin={spin && spin * (1 + i * 0.07)} />)}
      <line x1={ledA[0]} y1={ledA[1]} x2={ledB[0]} y2={ledB[1]} stroke="#2e1065" strokeWidth="1.6" strokeDasharray="10 14" strokeLinecap="round" opacity=".9">
        {motion && <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="1.2s" repeatCount="indefinite" />}
      </line>
      {/* heat rising off each fan: the hashrate, drawn */}
      {fans.map((c, i) => {
        const [x, y] = xy([c[0], c[1], 40]);
        return [0, 1, 2].map((k) => (
          <line key={`${i}-${k}`} x1={x - 10 + k * 10} y1={y} x2={x - 10 + k * 10} y2={y - 14} stroke="#2e1065" strokeWidth="1" strokeLinecap="round" opacity="0">
            {motion && (
              <>
                <animateTransform attributeName="transform" type="translate" values="0 0; 0 -34" dur="2.4s" begin={`${(i * 3 + k) * 0.27}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0; .7; 0" dur="2.4s" begin={`${(i * 3 + k) * 0.27}s`} repeatCount="indefinite" />
              </>
            )}
          </line>
        ));
      })}
      {/* name tag on the open left side, so it never runs past the figure's edge */}
      <text x={xy([0, D, 40])[0] - 8} y={xy([0, D, 40])[1]} className="fig-tick" style={{ textAnchor: "end" }}>{label}</text>
    </svg>
  );
}

// --- FIG. 2: the sorting machine ------------------------------------------------------

/** A face circle on a plane facing +y (the machine's front), e.g. a roller end. */
function Roller({ c, r, motion }: { c: V; r: number; motion: boolean }) {
  const [X, Y] = xy(c);
  return (
    <g transform={`matrix(${FRONT_M} ${X} ${Y})`}>
      <circle r={r}fill="url(#g-right)" stroke="#2e1065" strokeOpacity=".7" strokeWidth=".7" />
      <g stroke="#2e1065" strokeOpacity=".6" strokeWidth=".7">
        <line x1={-r} y1="0" x2={r} y2="0" />
        <line x1="0" y1={-r} x2="0" y2={r} />
        {motion && <animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="1.4s" repeatCount="indefinite" />}
      </g>
    </g>
  );
}

const STATIONS = [30, 90, 150, 210, 270];
const BELT: [number, number] = [-10, 330]; // x span of the belt top
// item kinds in loop order: -1 = agent (passes), n = bot rejected at station n
const BATCH = [-1, 1, -1, 3, -1, 0, -1, 4];

/** Agents ride the belt through five inspection stations into PASSED; bots are kicked off into REJECTED. */
export function MachineFigure() {
  const motion = useMotion();
  const DUR = 8;
  const P = (x: number, y: number, z: number) => xy([x, y, z]).join(" ");
  const arrive = (x: number) => 0.08 + ((x - BELT[0]) / (BELT[1] - BELT[0])) * 0.7;
  const grid = [];
  for (let i = -40; i <= 380; i += 20) grid.push([[i, -10, 0], [i, 110, 0]] as [V, V]);
  for (let j = -10; j <= 110; j += 20) grid.push([[-40, j, 0], [380, j, 0]] as [V, V]);

  return (
    <svg viewBox="-78 -84 436 270" className="fig-svg" role="img" aria-label="A sorting machine: agents ride a conveyor through five inspection stations into PASSED; bots are kicked off into REJECTED.">
      <ellipse cx="140" cy="50" rx="230" ry="110" fill="url(#g-glow)" />
      <g stroke="#4c1d95" strokeOpacity=".08">
        {grid.map(([a, b], i) => {
          const [x1, y1] = xy(a), [x2, y2] = xy(b);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      {/* ground layer: reject chute, legs, back pillars, PASSED bin */}
      <Box at={[20, 70, 0]} size={[275, 26, 4]} wire hatch />
      {[0, 150, 300].map((x) => (
        <g key={x}>
          <Box at={[x, 22, 0]} size={[6, 4, 14]} />
          <Box at={[x, 44, 0]} size={[6, 4, 14]} />
        </g>
      ))}
      {STATIONS.map((x) => <Box key={`bp${x}`} at={[x, 12, 24]} size={[22, 8, 34]} />)}
      <Box at={[336, 16, 0]} size={[36, 38, 18]} wire />

      {/* belt body, moving slats, rollers */}
      <Box at={[BELT[0], 20, 14]} size={[BELT[1] - BELT[0], 30, 10]} />
      {[26, 35, 44].map((y) => {
        const [x1, y1] = xy([BELT[0] + 4, y, 24]), [x2, y2] = xy([BELT[1] - 4, y, 24]);
        return (
          <line key={y} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e1534" strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="2 9">
            {motion && <animate attributeName="stroke-dashoffset" from="0" to="-22" dur="0.36s" repeatCount="indefinite" />}
          </line>
        );
      })}
      <Roller c={[BELT[0] + 5, 50, 19]} r={4.5} motion={motion} />
      <Roller c={[BELT[1] - 5, 50, 19]} r={4.5} motion={motion} />

      {/* intake hopper */}
      <Box at={[-24, 16, 42]} size={[26, 38, 22]} />
      <polygon points={poly([[-20, 20, 64], [-2, 20, 64], [-2, 50, 64], [-20, 50, 64]])} fill="#1e1534" stroke="#2e1065" strokeOpacity=".5" strokeWidth=".6" />

      {/* items on the belt */}
      {BATCH.map((kind, i) => {
        const bot = kind >= 0;
        const shape = bot ? (
          <Box at={[-6, -6, 0]} size={[12, 12, 12]} wire />
        ) : (
          <circle cx="0" cy="-5" r="5.5" fill="url(#g-ball)" stroke="#2e1065" strokeOpacity=".5" strokeWidth=".5" />
        );
        if (!motion) {
          const x = bot ? STATIONS[kind] - 16 : 10 + i * 40;
          return <g key={i} transform={`translate(${P(x, 35, 24)})`}>{shape}</g>;
        }
        let values: string, keyTimes: string;
        if (bot) {
          const sx = STATIONS[kind] - 16;
          const a = arrive(sx);
          values = [P(BELT[0], 35, 64), P(BELT[0], 35, 24), P(sx, 35, 24), P(sx, 35, 24), P(sx, 66, 24), P(sx, 82, 4), P(sx, 82, 4)].join("; ");
          keyTimes = [0, 0.08, a, a + 0.05, a + 0.1, a + 0.15, 1].map((t) => t.toFixed(3)).join("; ");
        } else {
          values = [P(BELT[0], 35, 64), P(BELT[0], 35, 24), P(BELT[1], 35, 24), P(352, 35, 4), P(352, 35, 4)].join("; ");
          keyTimes = "0; 0.08; 0.78; 0.84; 1";
        }
        const begin = `${(i * DUR) / BATCH.length}s`;
        return (
          <g key={i} opacity="0">
            {shape}
            <animateTransform attributeName="transform" type="translate" values={values} keyTimes={keyTimes} dur={`${DUR}s`} begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0; 1; 1; 0" keyTimes="0; .03; .93; 1" dur={`${DUR}s`} begin={begin} repeatCount="indefinite" />
          </g>
        );
      })}

      {/* stations: scan beam, front pillar, roof, lamp, number */}
      {STATIONS.map((x, k) => {
        const mid = x + 11;
        const [lx, ly] = xy([mid, 12, 86]);
        const [cx, cy] = xy([mid, 35, 72]);
        return (
          <g key={`st${x}`}>
            <polygon points={poly([[mid, 20, 24], [mid, 50, 24], [mid, 50, 58], [mid, 20, 58]])} fill="#7c3aed" opacity={motion ? 0 : 0.12}>
              {motion && <animate attributeName="opacity" values="0; .22; 0" dur="1.6s" begin={`${k * 0.32}s`} repeatCount="indefinite" />}
            </polygon>
            <Box at={[x, 50, 24]} size={[22, 8, 34]} />
            <Box at={[x, 12, 58]} size={[22, 46, 10]} />
            <Box at={[x + 7, 30, 68]} size={[8, 8, 3]} />
            <circle cx={cx} cy={cy} r="2.6" fill="#7c3aed">
              {motion && <animate attributeName="opacity" values=".25; 1; .25" dur="1.6s" begin={`${k * 0.32}s`} repeatCount="indefinite" />}
            </circle>
            <g transform={`translate(${lx} ${ly})`}>
              <rect x="-11" y="-9" width="22" height="13" className="fig-label-box" />
              <text x="0" y="1" className="fig-label">{`0${k + 1}`}</text>
            </g>
          </g>
        );
      })}

      {(() => {
        const [px, py] = xy([360, 66, 0]);
        const [rx, ry] = xy([60, 120, 0]);
        return (
          <>
            <text x={px} y={py + 12} className="fig-tick">PASSED</text>
            <text x={rx} y={ry + 14} className="fig-quarantine">REJECTED</text>
          </>
        );
      })()}
    </svg>
  );
}

// --- FIG. 3: pool tanks ---------------------------------------------------------------

/** One glass tank per asset; the fill is its balance against the fullest pool. */
export function TanksFigure({ pools }: { pools: { symbol: string; balance: bigint }[] }) {
  const motion = useMotion();
  const max = pools.reduce((m, p) => (p.balance > m ? p.balance : m), 0n);
  const W = 64, GAP = 40, TOP = 56, BOT = 270, X0 = 34;
  return (
    <svg viewBox="0 0 560 360" className="fig-svg" role="img" aria-label={`Pool levels: ${pools.map((p) => p.symbol).join(", ")}`}>
      <path d={`M${X0 + W / 2} ${BOT + 14} V 322 H ${X0 + 4 * (W + GAP) + W / 2}`} fill="none" stroke="#4c1d95" strokeOpacity=".25" />
      {pools.map((p, i) => {
        const x = X0 + i * (W + GAP);
        const level = max > 0n && p.balance > 0n ? Math.max(0.03, Number((p.balance * 1000n) / max) / 1000) : 0;
        const fillTop = BOT - level * (BOT - TOP);
        return (
          <g key={p.symbol}>
            <text x={x + W / 2} y={TOP - 30} className="fig-label" style={{ fontSize: 11 }}>{p.symbol}</text>
            {/* funding drips in from above */}
            {motion && level > 0 && (
              <circle cx={x + W / 2} r="2.6" fill="#7c3aed" opacity="0">
                <animate attributeName="cy" values={`${TOP - 20}; ${fillTop}`} dur="1.6s" begin={`${i * 0.37}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0; 1; 0" dur="1.6s" begin={`${i * 0.37}s`} repeatCount="indefinite" />
              </circle>
            )}
            <rect x={x} y={TOP} width={W} height={BOT - TOP} rx="6" fill="#f5f2fd" stroke="url(#g-sheen)" strokeWidth="1" />
            {level > 0 && (
              <>
                <rect x={x + 4} y={fillTop} width={W - 8} height={BOT - fillTop - 4} rx="3" fill="url(#g-liquid)" opacity=".85" />
                <line x1={x + 4} y1={fillTop} x2={x + W - 4} y2={fillTop} stroke="#ffffff" strokeWidth="1.4">
                  {motion && <animate attributeName="opacity" values=".4; 1; .4" dur="2.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />}
                </line>
              </>
            )}
            {[0.25, 0.5, 0.75].map((k) => (
              <line key={k} x1={x + W - 10} y1={BOT - k * (BOT - TOP)} x2={x + W} y2={BOT - k * (BOT - TOP)} stroke="#2e1065" strokeOpacity=".35" />
            ))}
            {/* hourly release flows out to the miners' bus */}
            <line x1={x + W / 2} y1={BOT} x2={x + W / 2} y2={BOT + 14} stroke="#4c1d95" strokeOpacity=".5" />
            {motion && level > 0 && (
              <path d={`M${x + W / 2} ${BOT} V 322 H ${X0 + 4 * (W + GAP) + W / 2 + 20}`} fill="none" stroke="#2e1065" strokeWidth="1.4" strokeDasharray="2 22" opacity=".8">
                <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="1.4s" repeatCount="indefinite" />
              </path>
            )}
          </g>
        );
      })}
      <text x={X0 + 4 * (W + GAP) + W / 2 + 26} y="326" className="fig-tick" style={{ textAnchor: "start" }}>miners</text>
    </svg>
  );
}

// --- agent characters -------------------------------------------------------------

/** Draws children flat on a box's front face (the plane y = at[1], facing the viewer's left). u runs along x, v runs up. */
function Front({ at, children }: { at: V; children: React.ReactNode }) {
  const [X, Y] = xy(at);
  return <g transform={`matrix(${FRONT_M} ${X} ${Y})`}>{children}</g>;
}

/** Draws children flat on a box's right face (the plane x = at[0]). u runs along y, v runs up. */
function Side({ at, children }: { at: V; children: React.ReactNode }) {
  const [X, Y] = xy(at);
  return <g transform={`matrix(${SIDE_M} ${X} ${Y})`}>{children}</g>;
}

const pulse = (motion: boolean, values: string, dur: string, begin = "0s") =>
  motion ? <animate attributeName="opacity" values={values} dur={dur} begin={begin} repeatCount="indefinite" /> : null;

function Scout({ motion }: { motion: boolean }) {
  // a hovering cube drone: visor band with one eye, antenna, thruster
  const bob = motion ? <animateTransform attributeName="transform" type="translate" values="0 0; 0 -6; 0 0" dur="3s" repeatCount="indefinite" /> : null;
  const [ax, ay] = xy([15, 15, 56]);
  return (
    <>
      <ellipse cx={xy([15, 15, 0])[0]} cy={xy([15, 15, 0])[1]} rx="22" ry="9" fill="#7c3aed" opacity=".12">
        {pulse(motion, ".08; .2; .08", "3s")}
      </ellipse>
      <g>
        {bob}
        <Box at={[8, 8, 14]} size={[14, 14, 6]} />
        <ellipse cx={xy([15, 15, 13])[0]} cy={xy([15, 15, 13])[1] + 3} rx="7" ry="3" fill="#c4b5fd" opacity=".7">
          {pulse(motion, ".3; .9; .3", "0.8s")}
        </ellipse>
        <Box at={[0, 0, 20]} size={[30, 30, 28]} />
        <Front at={[0, 30, 20]}>
          <rect x="3" y="11" width="24" height="9" rx="2" fill="#1e1534" stroke="#2e1065" strokeOpacity=".4" strokeWidth=".6" />
          <rect x="10" y="13" width="9" height="5" rx="1.5" fill="#ffffff">
            {pulse(motion, "1; 1; .15; 1; 1", "4s")}
          </rect>
        </Front>
        <Side at={[30, 0, 20]}>
          <rect x="6" y="8" width="18" height="2" fill="#7c3aed" opacity=".5" />
          <rect x="6" y="13" width="12" height="2" fill="#7c3aed" opacity=".35" />
        </Side>
        <line x1={ax} y1={ay} x2={ax} y2={ay - 16} stroke="#4c1d95" strokeWidth="1.4" />
        <circle cx={ax} cy={ay - 18} r="3" fill="url(#g-ball)">
          {pulse(motion, "1; .3; 1", "1.6s")}
        </circle>
      </g>
    </>
  );
}

function Rigger({ motion }: { motion: boolean }) {
  // a stocky miner: legs, body, head, hard hat with a headlamp
  const lamp = xy([15, 27, 64]);
  return (
    <>
      <Box at={[3, 6, 0]} size={[9, 9, 16]} />
      <Box at={[18, 6, 0]} size={[9, 9, 16]} />
      <Box at={[-6, 6, 22]} size={[6, 10, 20]} />
      <Box at={[0, 0, 16]} size={[30, 24, 28]} />
      <Box at={[30, 6, 22]} size={[6, 10, 20]} />
      <Front at={[0, 24, 16]}>
        {/* chest plate with a chip */}
        <rect x="8" y="8" width="14" height="12" fill="#1e1534" stroke="#2e1065" strokeOpacity=".5" strokeWidth=".6" />
        <rect x="12" y="11" width="6" height="6" fill="url(#g-top)">
          {pulse(motion, ".6; 1; .6", "2.2s")}
        </rect>
      </Front>
      <Box at={[5, 3, 44]} size={[20, 18, 16]} />
      <Front at={[5, 21, 44]}>
        <rect x="3" y="5" width="5" height="4" fill="#ffffff" />
        <rect x="12" y="5" width="5" height="4" fill="#ffffff" />
      </Front>
      <Box at={[2, 0, 60]} size={[26, 24, 4]} />
      <Box at={[6, 4, 64]} size={[18, 16, 7]} />
      {/* headlamp and its beam */}
      <polygon points={`${lamp[0]},${lamp[1]} ${lamp[0] - 46},${lamp[1] + 34} ${lamp[0] - 22},${lamp[1] + 48}`} fill="#7c3aed" opacity=".12">
        {pulse(motion, ".06; .2; .12; .2; .06", "2.6s")}
      </polygon>
      <circle cx={lamp[0]} cy={lamp[1]} r="3.4" fill="#ffffff" stroke="#4c1d95" strokeWidth=".6" />
    </>
  );
}

function Sentinel({ motion }: { motion: boolean }) {
  // a tall android: slim legs, torso, wide shoulders, visor that sweeps
  return (
    <>
      <Box at={[7, 7, 0]} size={[6, 6, 26]} />
      <Box at={[17, 7, 0]} size={[6, 6, 26]} />
      <Box at={[-4, 6, 30]} size={[5, 8, 26]} />
      <Box at={[4, 4, 26]} size={[22, 16, 30]} />
      <Box at={[29, 6, 30]} size={[5, 8, 26]} />
      <Front at={[4, 20, 26]}>
        <circle cx="11" cy="18" r="5" fill="#1e1534" stroke="#2e1065" strokeOpacity=".6" strokeWidth=".7" />
        <circle cx="11" cy="18" r="2.6" fill="#ffffff">
          {motion && <animate attributeName="r" values="2; 3.4; 2" dur="1.8s" repeatCount="indefinite" />}
        </circle>
      </Front>
      <Box at={[-2, 2, 54]} size={[34, 20, 7]} />
      <Box at={[9, 6, 61]} size={[12, 12, 4]} />
      <Box at={[6, 4, 65]} size={[18, 16, 18]} />
      <Front at={[6, 20, 65]}>
        <rect x="1" y="7" width="16" height="5" fill="#1e1534" stroke="#2e1065" strokeOpacity=".4" strokeWidth=".5" />
        <rect x="2" y="8" width="4" height="3" fill="#ffffff">
          {motion && <animate attributeName="x" values="2; 12; 2" dur="2.4s" repeatCount="indefinite" />}
        </rect>
      </Front>
      <line x1={xy([15, 12, 83])[0]} y1={xy([15, 12, 83])[1]} x2={xy([15, 12, 83])[0]} y2={xy([15, 12, 83])[1] - 10} stroke="#4c1d95" strokeWidth="1.2" />
    </>
  );
}

const CHARACTERS = { scout: Scout, rigger: Rigger, sentinel: Sentinel } as const;

/** One of the three agent characters, standing on a lit pad. */
export function AgentAvatar({ kind, size = 120, still }: { kind: string; size?: number; still?: boolean }) {
  const motion = useMotion() && !still;
  const C = CHARACTERS[kind as keyof typeof CHARACTERS] ?? Scout;
  const pad: V[] = [[-12, -12, 0], [42, -12, 0], [42, 42, 0], [-12, 42, 0]];
  return (
    <svg viewBox="-56 -100 120 140" width={size} height={size * (140 / 120)} className="avatar" role="img" aria-label={`${kind} agent`}>
      <ellipse cx="4" cy="14" rx="56" ry="30" fill="url(#g-glow)" />
      <polygon points={poly(pad)} fill="#ffffff" stroke="url(#g-sheen)" strokeWidth=".8" />
      <C motion={motion} />
    </svg>
  );
}
