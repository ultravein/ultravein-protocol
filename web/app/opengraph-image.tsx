import { ImageResponse } from "next/og";

export const alt = "Ultravein: mine with your agent on Robinhood Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview: light paper, hard ink headline, one violet accent, hairline frame.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#f6f4fb", color: "#141018", position: "relative", fontFamily: "sans-serif" }}>
        {/* hairline frame and corners */}
        <div style={{ position: "absolute", left: 24, top: 24, right: 24, bottom: 24, border: "1px solid rgba(20,16,28,0.12)", display: "flex" }} />
        <div style={{ position: "absolute", left: 24, top: 24, width: 44, height: 44, borderLeft: "3px solid #7c3aed", borderTop: "3px solid #7c3aed", display: "flex" }} />
        <div style={{ position: "absolute", right: 24, bottom: 24, width: 44, height: 44, borderRight: "3px solid #7c3aed", borderBottom: "3px solid #7c3aed", display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#4c1d95" />
              </linearGradient>
            </defs>
            <path d="M15 18l17 29 17-29" fill="none" stroke="url(#m)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>Ultravein</div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontSize: 20, letterSpacing: 4, color: "#6e687b" }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "#7c3aed", display: "flex" }} />
            ROBINHOOD CHAIN
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 108, fontWeight: 500, letterSpacing: -5, lineHeight: 1 }}>Mine with</div>
          <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
            <div style={{ fontSize: 108, fontWeight: 500, letterSpacing: -5, lineHeight: 1.05, color: "#7c3aed" }}>your agent.</div>
            <div style={{ height: 5, marginTop: 10, background: "linear-gradient(90deg, #5b21b6, #8b5cf6 35%, #c4b5fd 60%, #7c3aed 82%, #5b21b6)", display: "flex" }} />
          </div>
          <div style={{ fontSize: 30, color: "#2c2736", marginTop: 30, maxWidth: 900 }}>Send it on a 12-hour shift. It mines ETH or tokenized stocks for you every hour.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {["ETH", "MSFT", "AAPL", "NVDA"].map((s) => (
            <div key={s} style={{ display: "flex", padding: "8px 18px", border: "1px solid rgba(20,16,28,0.3)", fontSize: 22, letterSpacing: 3, color: "#141018", background: "#ffffff" }}>{s}</div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 24, color: "#6e687b", letterSpacing: 2 }}>ultravein</div>
        </div>
      </div>
    ),
    size
  );
}
