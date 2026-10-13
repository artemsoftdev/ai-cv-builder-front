import type { NextConfig } from "next";

// Rewrites are resolved at build time, so the Docker image takes this as a build arg.
function resolveApiInternalUrl(): string {
  const raw = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`API_INTERNAL_URL must be an absolute URL, got "${raw}"`);
  }
  return url.origin;
}

const apiInternalUrl = resolveApiInternalUrl();

// No nonces (they would make every page dynamic): inline scripts stay allowed, other origins don't.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/cvs", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }];
  },
  async headers() {
    // API responses carry their own headers (helmet).
    return [{ source: "/((?!api/).*)", headers: securityHeaders }];
  },
};

export default nextConfig;
