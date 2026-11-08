import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon: the violet M on white, same mark as icon.svg.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#4c1d95" />
            </linearGradient>
          </defs>
          <path d="M15 18l17 29 17-29" fill="none" stroke="url(#m)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size
  );
}
