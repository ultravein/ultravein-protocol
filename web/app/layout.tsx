import "./globals.css";
import type { Metadata } from "next";
import { SITE_URL, appLink, siteLink } from "@/lib/config";
import { ConnectButton, WalletProvider } from "./wallet";

const TITLE = "Ultravein · Your VGA, on the vein";
const DESCRIPTION = "Deploy a VGA free with what you hold, or buy one for good. It mines ETH, the token or tokenized stocks from the pool for you on Robinhood Chain.";

// Link previews need absolute image URLs: the configured site, else Vercel's production domain.
const base = SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Ultravein", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport = { themeColor: "#07040d", colorScheme: "dark" };

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
                {/* eslint-disable-next-line @next/next/no-img-element -- a 36px static mark, no optimisation needed */}
                <img src="/logo.png" width={36} height={36} alt="" className="brand__mark" />
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
                <a href={appLink()} className="btn">Deploy VGA</a>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
