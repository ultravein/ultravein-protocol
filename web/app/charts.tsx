"use client";
// Small single-series SVG charts in the silver theme: one axis, recessive grid,
// hover tooltip on every chart, and a table view for screen readers and copying.
import { useId, useState } from "react";

export type Datum = { label: string; value: number };

const W = 640;
const PAD = { l: 56, r: 14, t: 14, b: 30 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

export function num(v: number) {
  if (v === 0) return "0";
  if (Math.abs(v) >= 1000) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  if (Math.abs(v) < 0.0001) return v.toExponential(1);
  return String(+v.toPrecision(3));
}

/** Bar with a 4px rounded top, anchored to the baseline. */
function bar(x: number, y: number, w: number, h: number) {
  if (h <= 0.5) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function Chart({
  data,
  kind = "bar",
  height = 220,
  unit = "",
  title,
  empty = "No data yet.",
}: {
  data: Datum[];
  kind?: "bar" | "line";
  height?: number;
  unit?: string;
  title: string;
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  const n = data.length;
  if (!n || data.every((d) => d.value === 0))
    return (
      <div className="chart chart--empty" style={{ height }}>
        <span>{empty}</span>
      </div>
    );

  const H = height;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const step = iw / n;
  const X = (i: number) => PAD.l + step * i + step / 2;
  const Y = (v: number) => PAD.t + ih - (v / max) * ih;
  const bw = Math.max(2, Math.min(26, step - 4));
  const line = data.map((d, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(d.value).toFixed(1)}`).join("");
  const area = `${line}L${X(n - 1)},${Y(0)}L${X(0)},${Y(0)}Z`;
  const xLabels = [...new Set(n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1])];
  const h = hover === null ? null : data[hover];

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${n} points, highest ${num(Math.max(...data.map((d) => d.value)))} ${unit}.`}>
        <defs>
          <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c3aed" stopOpacity=".18" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(f * max)} y2={Y(f * max)} className="chart__grid" />
            <text x={PAD.l - 10} y={Y(f * max) + 3} className="chart__tick" style={{ textAnchor: "end" }}>{num(f * max)}</text>
          </g>
        ))}
        {kind === "bar" ? (
          data.map((d, i) => (
            <path
              key={i}
              d={bar(X(i) - bw / 2, Y(d.value), bw, Y(0) - Y(d.value))}
              fill={`url(#${id}b)`}
              className={`chart__bar ${hover === i ? "is-on" : ""} ${hover !== null && hover !== i ? "is-dim" : ""}`}
              style={{ animationDelay: `${Math.min(i * 18, 500)}ms` }}
            />
          ))
        ) : (
          <>
            <path d={area} fill={`url(#${id}a)`} className="chart__area" />
            <path d={line} className="chart__line" pathLength={1} />
          </>
        )}
        {h && kind === "line" && (
          <>
            <line x1={X(hover!)} x2={X(hover!)} y1={PAD.t} y2={Y(0)} className="chart__cross" />
            <circle cx={X(hover!)} cy={Y(h.value)} r="5" className="chart__dot" />
          </>
        )}
        {xLabels.map((i) => (
          <text key={i} x={X(i)} y={H - 9} className="chart__tick" style={{ textAnchor: i === 0 ? "start" : i === n - 1 ? "end" : "middle" }}>
            {data[i].label}
          </text>
        ))}
        {/* hit areas are the full column, wider than the marks */}
        {data.map((_, i) => (
          <rect key={i} x={PAD.l + step * i} y={PAD.t} width={step} height={ih} fill="transparent" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
        ))}
      </svg>
      {h && (
        <div className="chart__tip" style={{ left: `${(X(hover!) / W) * 100}%`, top: `${(Y(h.value) / H) * 100}%` }}>
          <span>{h.label}</span>
          <b>{num(h.value)} {unit}</b>
        </div>
      )}
      <details className="chart__table">
        <summary>View as table</summary>
        <table>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}><td>{d.label}</td><td>{d.value} {unit}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Circular progress; `value` is 0..1. */
export function Ring({ value, size = 132, children }: { value: number; size?: number; children?: React.ReactNode }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} className="ring__track" />
        <circle cx="60" cy="60" r={r} className="ring__fill" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} transform="rotate(-90 60 60)" />
        {Array.from({ length: 48 }, (_, i) => (
          <line key={i} x1="60" y1="2" x2="60" y2={i % 4 ? 5 : 8} transform={`rotate(${i * 7.5} 60 60)`} className="ring__tick" />
        ))}
      </svg>
      <div className="ring__body">{children}</div>
    </div>
  );
}

/** Segmented control for picking one series at a time. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? "is-on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
