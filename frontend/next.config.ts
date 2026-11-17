import type { NextConfig } from "next";

/**
 * Deployment model
 * ────────────────
 * The browser only ever talks to this Next.js origin. `/api/*` and `/uploads/*`
 * are proxied to the Express backend (BACKEND_URL), which keeps the httpOnly
 * refresh-token cookie first-party (no third-party cookie issues) and removes
 * the need for browser CORS. WebSockets cannot be proxied by Vercel, so
 * Socket.IO connects directly to NEXT_PUBLIC_SOCKET_URL with a bearer token.
 */

// On Vercel these are baked in at build time; building without them would ship a
// site that silently proxies to localhost. Fail the build with a clear message.
if (process.env.VERCEL === "1") {
  const missing = ["BACKEND_URL", "NEXT_PUBLIC_SOCKET_URL", "NEXT_PUBLIC_SITE_URL"].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s) on Vercel: ${missing.join(", ")}. See docs/deployment.md.`);
  }
}

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:5000").replace(/\/$/, "");
const SOCKET_URL = (process.env.NEXT_PUBLIC_SOCKET_URL ?? BACKEND_URL).replace(/\/$/, "");
const isDev = process.env.NODE_ENV !== "production";

const socketOrigins = (() => {
  try {
    const u = new URL(SOCKET_URL);
    const ws = `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`;
    return `${u.origin} ${ws}`;
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode additionally needs eval for HMR.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com",
  "font-src 'self' data:",
  `connect-src 'self' ${socketOrigins}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    qualities: [60, 75, 85],
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
