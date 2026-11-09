import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Ultravein: your VGA, on the vein. Robinhood Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview: near-black field with the logo's violet glow, the emblem on the right.
export default async function OpenGraphImage() {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), "app/og-logo.png"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "64px 72px",
          background: "radial-gradient(900px 520px at 82% 30%, rgba(85,18,224,0.42), transparent 70%), radial-gradient(700px 420px at 0% 0%, rgba(59,15,168,0.3), transparent 70%), #07040d",
          color: "#f6f1ff",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* hairline frame with violet corners */}
        <div style={{ position: "absolute", left: 24, top: 24, right: 24, bottom: 24, border: "1px solid rgba(196,166,255,0.18)", display: "flex" }} />
        <div style={{ position: "absolute", left: 24, top: 24, width: 44, height: 44, borderLeft: "3px solid #8f4dff", borderTop: "3px solid #8f4dff", display: "flex" }} />
        <div style={{ position: "absolute", right: 24, bottom: 24, width: 44, height: 44, borderRight: "3px solid #8f4dff", borderBottom: "3px solid #8f4dff", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>Ultravein</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, letterSpacing: 4, color: "#8a80a8", marginLeft: 18 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: "#8f4dff", display: "flex" }} />
              ROBINHOOD CHAIN
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 100, fontWeight: 500, letterSpacing: -5, lineHeight: 1 }}>Your VGA,</div>
            <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
              <div style={{ fontSize: 100, fontWeight: 500, letterSpacing: -5, lineHeight: 1.05, color: "#b994ff" }}>on the vein.</div>
              <div style={{ height: 5, marginTop: 10, background: "linear-gradient(90deg, #3b0fa8, #7a2cff 35%, #d4b8ff 60%, #8f4dff 82%, #3b0fa8)", display: "flex" }} />
            </div>
            <div style={{ fontSize: 28, color: "#cdc3e6", marginTop: 28, maxWidth: 640 }}>Deploy one free or buy it for good. It mines ETH or tokenized stocks every hour.</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {["ETH", "MSFT", "AAPL", "NVDA"].map((s) => (
              <div key={s} style={{ display: "flex", padding: "8px 18px", border: "1px solid rgba(196,166,255,0.35)", fontSize: 22, letterSpacing: 3, color: "#f6f1ff", background: "rgba(143,77,255,0.12)" }}>{s}</div>
            ))}
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain img */}
        <img src={logo} width={420} height={420} alt="" style={{ position: "absolute", right: 56, top: 105 }} />
      </div>
    ),
    size
  );
}
