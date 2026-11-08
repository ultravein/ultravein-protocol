import "./globals.css";
import type { Metadata } from "next";
import { SITE_URL, appLink, siteLink } from "@/lib/config";
import { ConnectButton, WalletProvider } from "./wallet";

const TITLE = "Ultravein · Mine with your agent";
const DESCRIPTION = "Deploy an agent, send it on a 12-hour shift, and it mines ETH, the token or tokenized stocks for you on Robinhood Chain.";

// Link previews need absolute image URLs: the configured site, else Vercel's production domain.
const base = SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Ultravein", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <WalletProvider>
          <header className="site-header">
            <div className="site-header__bar">
              <a href={siteLink("/")} className="brand" aria-label="Ultravein home">
                <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                  <path d="M2 4l9 15 9-15" fill="none" stroke="url(#brand-g)" strokeWidth="2.4" strokeLinejoin="round" />
                  <defs>
                    <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#8b5cf6" />
                      <stop offset="1" stopColor="#4c1d95" />
                    </linearGradient>
                  </defs>
                </svg>
                Ultravein
              </a>
              <nav className="site-nav" aria-label="Main">
                <a href={siteLink("/#board")}>Board</a>
                <a href={siteLink("/#pools")}>Pools</a>
                <a href={siteLink("/#safeguards")}>Safeguards</a>
                <a href={siteLink("/#roadmap")}>Roadmap</a>
                <a href={siteLink("/docs")}>Docs</a>
              </nav>
              <div className="site-header__actions">
                <ConnectButton />
                <a href={appLink()} className="btn">Deploy agent</a>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
