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

const securityHeaders = [
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
