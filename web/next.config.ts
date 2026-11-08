import type { NextConfig } from "next";

// Hosts come from the same env vars the links use, so nothing points at a domain we do not own.
// Unset (local dev, *.vercel.app), the host rules below never match.
const hostOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
};
const APP_HOST = hostOf(process.env.NEXT_PUBLIC_APP_URL);
const SITE_HOST = hostOf(process.env.NEXT_PUBLIC_SITE_URL);

const config: NextConfig = {
  // the app subdomain serves the dashboard at its root. beforeFiles runs before "/" (the home page) matches.
  async rewrites() {
    return {
      beforeFiles: APP_HOST ? [{ source: "/", has: [{ type: "host", value: APP_HOST }], destination: "/app" }] : [],
      afterFiles: [],
      fallback: [],
    };
  },
  // the dashboard's path on the main domain moves to the subdomain
  async redirects() {
    if (!APP_HOST || !SITE_HOST) return [];
    return [SITE_HOST, `www.${SITE_HOST}`].map((host) => ({
      source: "/app",
      has: [{ type: "host" as const, value: host }],
      destination: `https://${APP_HOST}/`,
      permanent: true,
    }));
  },
};
export default config;
