"use client";
// Ultravein's own figures: a GPU rig, a sieve and pool tanks, in brushed silver.
// Motion uses SMIL so it runs off the main thread; it is dropped for reduced motion.
import { useEffect, useState } from "react";

type V = [number, number, number];
// Asymmetric 3/4 camera (dimetric) seen from the opposite side: x runs 20deg below horizontal to
// the LEFT, y runs 40deg down to the right and slightly foreshortened, so figures face down-left
// and the front faces read wider than the sides. Every plane matrix below is built from these two
// axes, so changing them re-angles every figure at once.
const AX: [number, number] = [-0.94, 0.342];
const AY: [number, number] = [0.651, 0.546];
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
        {/* line-drawing style: near-flat paper faces, the ink edges carry the form */}
        <linearGradient id="g-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#fbfaff" />
        </linearGradient>
        <linearGradient id="g-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f4fe" />
          <stop offset="1" stopColor="#efe9fc" />
        </linearGradient>
        <linearGradient id="g-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6ddfa" />
          <stop offset="1" stopColor="#d9cdf6" />
        </linearGradient>
        <linearGradient id="g-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b21b6" />
          <stop offset=".35" stopColor="#8b5cf6" />
          <stop offset=".6" stopColor="#c4b5fd" />
          <stop offset=".8" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id="g-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <pattern id="g-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V4" stroke="#4c1d95" strokeOpacity=".45" />
        </pattern>
        <radialGradient id="g-ball" cx=".35" cy=".35">
          <stop offset="0" stopColor="#ddd6fe" />
          <stop offset="1" stopColor="#6d28d9" />
        </radialGradient>
        <radialGradient id="g-glow">
          <stop offset="0" stopColor="#a78bfa" stopOpacity=".14" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** A solid box with its three visible faces (larger x + y is closer to the viewer). `lit` fills it violet. */
function Box({ at: [x, y, z], size: [w, d, h], wire, hatch, lit }: { at: V; size: V; wire?: boolean; hatch?: boolean; lit?: boolean }) {
  const top: V[] = [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]];
  const right: V[] = [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]];
  const left: V[] = [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]];
  if (wire)
    return (
      <g fill={hatch ? "url(#g-hatch)" : "none"} stroke="#141018" strokeOpacity=".75" strokeWidth=".8" strokeDasharray="3 2" strokeLinejoin="round">
        <polygon points={poly(top)} />
        <polygon points={poly(right)} />
        <polygon points={poly(left)} />
      </g>
    );
  return (
    <g stroke="#141018" strokeOpacity=".88" strokeWidth=".7" strokeLinejoin="round">
      <polygon points={poly(left)} fill={lit ? "#8b5cf6" : "url(#g-left)"} />
      <polygon points={poly(right)} fill={lit ? "#6d28d9" : "url(#g-right)"} />
      <polygon points={poly(top)} fill={lit ? "#c4b5fd" : "url(#g-top)"} />
    </g>
  );
}

/** The 12-hour dig as twelve blocks on a rail: past hours lit violet, the current hour pulsing with
 *  a scan line rising through it, future hours as wireframes. Replaces a flat progress ring. */
export function HourBlocks({ progress, running }: { progress: number; running: boolean }) {
  const motion = useMotion() && running;
  const done = running ? Math.min(12, Math.floor(progress * 12)) : 0;
  const S = 14, G = 6;
  return (
    <svg viewBox="-230 -40 260 150" className="fig-svg hours" role="img" aria-label={running ? `${done} of 12 hours dug` : "Idle: 12 hours ready"}>
      <ellipse cx="-100" cy="40" rx="140" ry="50" fill="url(#g-glow)" />
      <Box at={[-4, -4, -4]} size={[12 * (S + G) - G + 8, S + 8, 4]} />
      {Array.from({ length: 12 }, (_, i) => {
        const x = (11 - i) * (S + G); // hour 0 sits at screen left with the mirrored camera
        if (i < done) return <Box key={i} at={[x, 0, 0]} size={[S, S, S + 4]} lit />;
        if (running && i === done) {
          const [ax, ay] = xy([x, 0, 1]), [bx, by] = xy([x + S, 0, 1]), [cx, cy] = xy([x + S, S, 1]), [dx, dy] = xy([x, S, 1]);
          return (
            <g key={i}>
              <Box at={[x, 0, 0]} size={[S, S, S + 4]} wire />
              <polygon points={`${ax},${ay} ${bx},${by} ${cx},${cy} ${dx},${dy}`} fill="#7c3aed" fillOpacity=".25" stroke="#7c3aed" strokeWidth=".9">
                {motion && (
                  <>
                    <animateTransform attributeName="transform" type="translate" values={`0 0; 0 ${-(S + 2)}`} dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1; .2" dur="1.6s" repeatCount="indefinite" />
                  </>
                )}
              </polygon>
            </g>
          );
        }
        return <Box key={i} at={[x, 0, 0]} size={[S, S, S + 4]} wire />;
      })}
      {[0, 6, 12].map((h) => {
        const [tx, ty] = xy([(12 - h) * (S + G) - G, S + 10, -4]);
        return <text key={h} x={tx} y={ty + 12} className="fig-tick">{`${h}h`}</text>;
      })}
    </svg>
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
      <rect x="3.5" y="3.5" width="15" height="15" rx="1.5" fill="url(#g-left)" stroke="#141018" strokeOpacity=".7" strokeWidth=".8" />
      <rect x="7" y="7" width="8" height="8" rx=".8" fill="url(#g-top)" />
    </svg>
  );
}

// --- FIG. 1: the rig ----------------------------------------------------------------

/** One fan as a line drawing laid on the card's top plane: thin blade strokes, a ticked bezel,
 *  and a violet arc that sweeps the rim (the motion), instead of a solid spinning rotor. */
function Fan({ c, r, spin, m = TOP_M }: { c: V; r: number; spin: number | null; m?: string }) {
  const [X, Y] = xy(c);
  const blades = Array.from({ length: 7 }, (_, i) => (i * 360) / 7);
  const arc = Math.PI * 2 * (r + 2);
  return (
    <g transform={`matrix(${m} ${X} ${Y})`}>
      <circle r={r + 4} fill="#ffffff" stroke="#141018" strokeOpacity=".85" strokeWidth=".7" />
      <circle r={r + 4} fill="none" stroke="#141018" strokeOpacity=".5" strokeWidth="2.2" strokeDasharray="0.6 5.2" />
      <g fill="none" stroke="#141018" strokeOpacity=".7" strokeWidth=".6" strokeLinecap="round">
        {blades.map((a) => (
          <path key={a} d={`M${r * 0.26} 0 Q ${r * 0.6} ${-r * 0.32} ${r * 0.9} ${-r * 0.06}`} transform={`rotate(${a})`} />
        ))}
        {spin && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={`${spin * 2.4}s`} repeatCount="indefinite" />}
      </g>
      <circle r={r + 2} fill="none" stroke="#7c3aed" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={`${arc * 0.22} ${arc}`}>
        {spin && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={`${spin}s`} repeatCount="indefinite" />}
      </circle>
      <circle r={r * 0.22} fill="#ffffff" stroke="#141018" strokeOpacity=".85" strokeWidth=".7" />
      <circle r={r * 0.07} fill="#7c3aed" />
    </g>
  );
}

/** An open-air mining frame: three GPU cards standing upright on risers between two posts, each
 *  with a fan on its side. Fans spin faster as more agents mine; a scan plane sweeps the rack. */
export function RigFigure({ agents, idle, label = "ultravein-01" }: { agents: number; idle?: boolean; label?: string }) {
  const motion = useMotion() && !idle;
  const spin = motion ? Math.max(0.5, 3.2 - agents * 0.25) : null;
  const L = 240, D = 70;
  const CARDS = [40, 110, 180];
  const CW = 14, CD = 52, CH = 66, CY = 12, CZ = 14;
  const grid = [];
  for (let i = -40; i <= L + 40; i += 20) grid.push([[i, -30, 0], [i, D + 30, 0]] as [V, V]);
  for (let j = -30; j <= D + 30; j += 20) grid.push([[-40, j, 0], [L + 40, j, 0]] as [V, V]);
  const ledA = xy([6, D, 4]);
  const ledB = xy([L - 6, D, 4]);
  return (
    <svg viewBox="-240 -112 310 244" className="fig-svg" role="img" aria-label={`An open mining frame with three upright graphics cards. ${agents} agents mining.`}>
      <ellipse cx="-90" cy="40" rx="190" ry="100" fill="url(#g-glow)" />
      <g stroke="#4c1d95" strokeOpacity=".09">
        {grid.map(([a, b], i) => {
          const [x1, y1] = xy(a), [x2, y2] = xy(b);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      {/* base plate, back posts and the top bar */}
      <Box at={[0, 0, 0]} size={[L, D, 8]} />
      <Box at={[0, 0, 8]} size={[8, 8, 84]} />
      <Box at={[L - 8, 0, 8]} size={[8, 8, 84]} />
      <Box at={[0, 0, 92]} size={[L, 8, 6]} />
      {/* cards, back to front: riser, card body, PCIe edge, fins, side fan */}
      {CARDS.map((x, i) => (
        <g key={x}>
          <Box at={[x + 2, CY + 14, 8]} size={[CW - 4, CD - 28, 6]} />
          <Box at={[x, CY, CZ]} size={[CW, CD, CH]} />
          {(() => {
            const [ax, ay] = xy([x, CY + CD, CZ + 3]), [bx, by] = xy([x + CW, CY + CD, CZ + 3]);
            return <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#7c3aed" strokeWidth="2.4" />;
          })()}
          {Array.from({ length: 6 }, (_, k) => {
            const [ax, ay] = xy([x + 2, CY + 6 + k * 8, CZ + CH]), [bx, by] = xy([x + CW - 2, CY + 6 + k * 8, CZ + CH]);
            return <line key={k} x1={ax} y1={ay} x2={bx} y2={by} stroke="#141018" strokeOpacity=".45" strokeWidth=".6" />;
          })}
          <Fan c={[x + CW, CY + CD / 2, CZ + CH / 2]} r={19} spin={spin && spin * (1 + i * 0.09)} m={SIDE_M} />
        </g>
      ))}
      {/* data packets running along the base's front edge */}
      <line x1={ledA[0]} y1={ledA[1]} x2={ledB[0]} y2={ledB[1]} stroke="#7c3aed" strokeWidth="2.2" strokeDasharray="3 21" strokeLinecap="square">
        {motion && <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="0.9s" repeatCount="indefinite" />}
      </line>
      {/* a scan plane sweeps the rack end to end: the hashrate, drawn as a laser pass */}
      {(() => {
        const a = xy([4, -4, 86]), b = xy([4, D + 4, 86]), c = xy([4, D + 4, 8]), d = xy([4, -4, 8]);
        const run = L - 8;
        const dx = +(run * AX[0]).toFixed(2), dy = +(run * AX[1]).toFixed(2);
        const sweep = motion ? <animateTransform attributeName="transform" type="translate" values={`0 0; ${dx} ${dy}; ${dx} ${dy}`} keyTimes="0; .85; 1" dur={`${Math.max(1.6, (spin ?? 3) * 1.3)}s`} repeatCount="indefinite" /> : null;
        return (
          <g opacity={motion ? 1 : 0}>
            {sweep}
            <polygon points={`${a.join(",")} ${b.join(",")} ${c.join(",")} ${d.join(",")}`} fill="#7c3aed" fillOpacity=".06" />
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#7c3aed" strokeWidth="1.2" />
            <line x1={d[0]} y1={d[1]} x2={c[0]} y2={c[1]} stroke="#7c3aed" strokeWidth=".6" strokeDasharray="2 3" />
            <circle cx={a[0]} cy={a[1]} r="2" fill="#7c3aed" />
            <circle cx={b[0]} cy={b[1]} r="2" fill="#7c3aed" />
          </g>
        );
      })()}
      {/* name tag above the near post */}
      <text x={xy([0, 0, 98])[0] + 6} y={xy([0, 0, 98])[1] - 6} className="fig-tick" style={{ textAnchor: "start" }}>{label}</text>
    </svg>
  );
}
// --- FIG. 2: the sorting machine ------------------------------------------------------

/** A face circle on a plane facing +y (the machine's front), e.g. a roller end. */
function Roller({ c, r, motion }: { c: V; r: number; motion: boolean }) {
  const [X, Y] = xy(c);
  return (
    <g transform={`matrix(${FRONT_M} ${X} ${Y})`}>
      <circle r={r}fill="url(#g-right)" stroke="#141018" strokeOpacity=".7" strokeWidth=".7" />
      <g stroke="#141018" strokeOpacity=".6" strokeWidth=".7">
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
    <svg viewBox="-358 -84 436 270" className="fig-svg" role="img" aria-label="A sorting machine: agents ride a conveyor through five inspection stations into PASSED; bots are kicked off into REJECTED.">
      <ellipse cx="-140" cy="50" rx="230" ry="110" fill="url(#g-glow)" />
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
      <polygon points={poly([[-20, 20, 64], [-2, 20, 64], [-2, 50, 64], [-20, 50, 64]])} fill="#1e1534" stroke="#141018" strokeOpacity=".5" strokeWidth=".6" />

      {/* items on the belt */}
      {BATCH.map((kind, i) => {
        const bot = kind >= 0;
        const shape = bot ? (
          <Box at={[-6, -6, 0]} size={[12, 12, 12]} wire />
        ) : (
          <g>
            <circle cx="0" cy="-5" r="5.5" fill="#ffffff" stroke="#7c3aed" strokeWidth="1.3" />
            <circle cx="0" cy="-5" r="1.8" fill="#7c3aed" />
          </g>
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
            {/* a laser line drops through the station, top to belt */}
            {(() => {
              const [ax, ay] = xy([mid, 20, 57]), [bx, by] = xy([mid, 50, 57]);
              return (
                <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#7c3aed" strokeWidth="1.3" opacity={motion ? 0 : 0.5}>
                  {motion && (
                    <>
                      <animateTransform attributeName="transform" type="translate" values="0 0; 0 32" dur="1.6s" begin={`${k * 0.32}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0; 1; 1; 0" keyTimes="0; .1; .8; 1" dur="1.6s" begin={`${k * 0.32}s`} repeatCount="indefinite" />
                    </>
                  )}
                </line>
              );
            })()}
            <Box at={[x, 50, 24]} size={[22, 8, 34]} />
            <Box at={[x, 12, 58]} size={[22, 46, 10]} />
            <Box at={[x + 7, 30, 68]} size={[8, 8, 3]} />
            <circle cx={cx} cy={cy} r="2" fill="#7c3aed" />
            <circle cx={cx} cy={cy} r="2" fill="none" stroke="#7c3aed" strokeWidth=".8" opacity="0">
              {motion && (
                <>
                  <animate attributeName="r" values="2; 9" dur="1.6s" begin={`${k * 0.32}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values=".9; 0" dur="1.6s" begin={`${k * 0.32}s`} repeatCount="indefinite" />
                </>
              )}
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
            <rect x={x} y={TOP} width={W} height={BOT - TOP} fill="#ffffff" stroke="#141018" strokeOpacity=".85" strokeWidth=".8" />
            {level > 0 && (
              <>
                <rect x={x + 5} y={fillTop} width={W - 10} height={BOT - fillTop - 5} fill="url(#g-liquid)" opacity=".75" />
                <rect x={x + 5} y={fillTop} width={W - 10} height={BOT - fillTop - 5} fill="url(#g-hatch)" opacity=".5" />
                <line x1={x - 6} y1={fillTop} x2={x + W + 6} y2={fillTop} stroke="#7c3aed" strokeWidth="1" strokeDasharray="2 2" />
                {/* bubbles rise through the liquid: the pool is live */}
                {motion &&
                  [0.25, 0.55, 0.8].map((k, j) => (
                    <circle key={k} cx={x + 5 + k * (W - 10)} r="1.8" fill="none" stroke="#ffffff" strokeWidth=".9" opacity="0">
                      <animate attributeName="cy" values={`${BOT - 8}; ${fillTop + 4}`} dur={`${2.2 + j * 0.5}s`} begin={`${i * 0.3 + j * 0.6}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0; 1; 1; 0" keyTimes="0; .15; .85; 1" dur={`${2.2 + j * 0.5}s`} begin={`${i * 0.3 + j * 0.6}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
              </>
            )}
            {[0.25, 0.5, 0.75].map((k) => (
              <line key={k} x1={x + W - 10} y1={BOT - k * (BOT - TOP)} x2={x + W} y2={BOT - k * (BOT - TOP)} stroke="#141018" strokeOpacity=".35" />
            ))}
            {/* hourly release flows out to the miners' bus */}
            <line x1={x + W / 2} y1={BOT} x2={x + W / 2} y2={BOT + 14} stroke="#4c1d95" strokeOpacity=".5" />
            {motion && level > 0 && (
              <path d={`M${x + W / 2} ${BOT} V 322 H ${X0 + 4 * (W + GAP) + W / 2 + 20}`} fill="none" stroke="#7c3aed" strokeWidth="3" strokeDasharray="3 21" strokeLinecap="square">
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

/** Flat triangle/quad on any plane, from 3D points. */
const Face = ({ pts, fill, op = 0.88 }: { pts: V[]; fill: string; op?: number }) => (
  <polygon points={poly(pts)} fill={fill} stroke="#141018" strokeOpacity={op} strokeWidth=".7" strokeLinejoin="round" />
);

function Scout({ motion }: { motion: boolean }) {
  // a crystal probe: an octahedron floating over the pad, a slit eye, an orbit ring and a dot riding it
  const C: V = [15, 15, 46];
  const T: V = [15, 15, 68], B: V = [15, 15, 26];
  const E1: V = [32, 15, 46], E2: V = [15, 32, 46], E3: V = [-2, 15, 46], E4: V = [15, -2, 46];
  const bob = motion ? <animateTransform attributeName="transform" type="translate" values="0 0; 0 -7; 0 0" dur="3.2s" repeatCount="indefinite" /> : null;
  const [fx, fy] = xy([20, 20, 50]);
  const [X, Y] = xy(C);
  return (
    <>
      <ellipse cx={xy([15, 15, 0])[0]} cy={xy([15, 15, 0])[1]} rx="16" ry="7" fill="#141018" opacity=".08">
        {pulse(motion, ".05; .12; .05", "3.2s")}
      </ellipse>
      <g>
        {bob}
        <Face pts={[B, E2, E3]} fill="#d9cdf6" />
        <Face pts={[B, E4, E1]} fill="#cbbcf3" />
        <Face pts={[B, E1, E2]} fill="url(#g-right)" />
        <Face pts={[T, E2, E3]} fill="url(#g-left)" />
        <Face pts={[T, E4, E1]} fill="#efe9fc" />
        <Face pts={[T, E1, E2]} fill="url(#g-top)" />
        {/* slit eye on the front face */}
        <polygon points={poly([[17, 21, 52], [23, 15, 52], [23, 15, 49], [17, 21, 49]].map(([x, y, z]) => [x + 2, y + 2, z] as V))} fill="#1e1534" />
        <circle cx={fx} cy={fy} r="1.6" fill="#ffffff">{pulse(motion, "1; .2; 1", "1.4s")}</circle>
        <g transform={`matrix(${TOP_M} ${X} ${Y})`}>
          <circle r="27" fill="none" stroke="#141018" strokeOpacity=".45" strokeWidth=".6" strokeDasharray="2 3" />
          <g>
            <circle cx="27" cy="0" r="2.6" fill="#7c3aed" />
            {motion && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.8s" repeatCount="indefinite" />}
          </g>
        </g>
      </g>
    </>
  );
}

function Rigger({ motion }: { motion: boolean }) {
  // a tracked crawler: two treads, a low hull, a turret with a lamp, a drill arm pointing forward
  const P: V = [14, 54, 24];
  const A: V = [10, 40, 20], Bq: V = [18, 40, 20], Cq: V = [18, 40, 28], Dq: V = [10, 40, 28];
  const lamp = xy([14, 24, 30]);
  const [mx, my] = xy([20, 12, 32]);
  return (
    <>
      <Box at={[-4, 0, 0]} size={[8, 36, 10]} />
      <Box at={[4, 2, 6]} size={[20, 32, 12]} />
      <Box at={[24, 0, 0]} size={[8, 36, 10]} />
      {/* tread links crawling along the near tread */}
      <Side at={[32, 0, 0]}>
        <line x1="2" y1="5" x2="34" y2="5" stroke="#141018" strokeOpacity=".7" strokeWidth="3" strokeDasharray="2 3">
          {motion && <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="0.5s" repeatCount="indefinite" />}
        </line>
      </Side>
      <Front at={[-4, 36, 0]}>
        <circle cx="4" cy="5" r="3" fill="#ffffff" stroke="#141018" strokeOpacity=".8" strokeWidth=".6" />
      </Front>
      <Front at={[24, 36, 0]}>
        <circle cx="4" cy="5" r="3" fill="#ffffff" stroke="#141018" strokeOpacity=".8" strokeWidth=".6" />
      </Front>
      <Box at={[8, 8, 18]} size={[13, 16, 11]} />
      <Box at={[12, 24, 22]} size={[4, 16, 4]} />
      {/* drill: a cone off the arm, its spiral spinning */}
      <Face pts={[P, Cq, Dq]} fill="url(#g-top)" />
      <Face pts={[P, Bq, Cq]} fill="url(#g-right)" />
      {(() => {
        const [px, py] = xy(P), [cx, cy] = xy([14, 40, 24]);
        return (
          <line x1={cx} y1={cy} x2={px} y2={py} stroke="#7c3aed" strokeWidth="1.4" strokeDasharray="2 2">
            {motion && <animate attributeName="stroke-dashoffset" from="0" to="-8" dur="0.3s" repeatCount="indefinite" />}
          </line>
        );
      })()}
      <polygon points={poly([A, Bq, Cq, Dq])} fill="none" stroke="#141018" strokeOpacity=".5" strokeWidth=".6" />
      {/* mast and headlamp */}
      <line x1={mx} y1={my} x2={mx} y2={my - 18} stroke="#141018" strokeWidth="1" />
      <circle cx={mx} cy={my - 20} r="2.2" fill="#7c3aed">{pulse(motion, "1; .3; 1", "1.2s")}</circle>
      <polygon points={`${lamp[0]},${lamp[1]} ${lamp[0] + 40},${lamp[1] + 26} ${lamp[0] + 20},${lamp[1] + 40}`} fill="#7c3aed" opacity=".1">
        {pulse(motion, ".05; .18; .05", "2.4s")}
      </polygon>
      <circle cx={lamp[0]} cy={lamp[1]} r="2.6" fill="#ffffff" stroke="#141018" strokeWidth=".6" />
    </>
  );
}

function Sentinel({ motion }: { motion: boolean }) {
  // a floating pylon: footing, two segments hovering apart, a glowing core between, a pyramid cap and halo
  const hover = (dy: number, begin: string) =>
    motion ? <animateTransform attributeName="transform" type="translate" values={`0 0; 0 ${-dy}; 0 0`} dur="3s" begin={begin} repeatCount="indefinite" /> : null;
  const apex: V = [15, 15, 92];
  const [hx, hy] = xy([15, 15, 98]);
  return (
    <>
      <Box at={[4, 4, 0]} size={[22, 22, 8]} />
      <g>
        {hover(3, "0s")}
        <Box at={[7, 7, 14]} size={[16, 16, 24]} />
        <Front at={[7, 23, 14]}>
          <rect x="3" y="6" width="10" height="2" fill="#7c3aed" opacity=".6" />
          <rect x="3" y="11" width="6" height="2" fill="#7c3aed" opacity=".4" />
        </Front>
      </g>
      <g>
        {hover(5, ".2s")}
        <Box at={[11, 11, 43]} size={[8, 8, 8]} lit />
        <circle cx={xy([15, 15, 47])[0]} cy={xy([15, 15, 47])[1]} r="10" fill="#a78bfa" opacity=".18">
          {pulse(motion, ".08; .3; .08", "1.6s")}
        </circle>
      </g>
      <g>
        {hover(7, ".4s")}
        <Box at={[7, 7, 56]} size={[16, 16, 20]} />
        <Front at={[7, 23, 56]}>
          <rect x="1" y="9" width="14" height="4" fill="#1e1534" />
          <rect x="2" y="10" width="3" height="2" fill="#ffffff">
            {motion && <animate attributeName="x" values="2; 11; 2" dur="2.2s" repeatCount="indefinite" />}
          </rect>
        </Front>
        <Face pts={[apex, [23, 7, 76], [23, 23, 76]]} fill="url(#g-right)" />
        <Face pts={[apex, [23, 23, 76], [7, 23, 76]]} fill="url(#g-left)" />
        <g transform={`matrix(${TOP_M} ${hx} ${hy})`}>
          <circle r="9" fill="none" stroke="#7c3aed" strokeWidth="1" strokeDasharray="3 4">
            {motion && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite" />}
          </circle>
        </g>
      </g>
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
    <svg viewBox="-58 -94 108 134" width={size} height={size * (134 / 108)} className="avatar" role="img" aria-label={`${kind} agent`}>
      <ellipse cx="-4" cy="14" rx="56" ry="30" fill="url(#g-glow)" />
      <polygon points={poly(pad)} fill="#ffffff" stroke="#141018" strokeOpacity=".85" strokeWidth=".7" />
      {/* an orbit ring on the floor, a violet tick riding it */}
      {(() => {
        const [X, Y] = xy([15, 15, 0]);
        return (
          <g transform={`matrix(${TOP_M} ${X} ${Y})`}>
            <circle r="36" fill="none" stroke="#141018" strokeOpacity=".3" strokeWidth=".6" strokeDasharray="1.5 3" />
            <g>
              <circle cx="36" cy="0" r="2.4" fill="#7c3aed" />
              {motion && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />}
            </g>
          </g>
        );
      })()}
      <C motion={motion} />
    </svg>
  );
}
