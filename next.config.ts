import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        // When running `npm run dev` (nextjs dev server) we proxy api requests to
        // the local wrangler dev server (started with `npx wrangler dev`).
        destination: "http://localhost:8787/api/:path*",
      },
    ];
  },
};

export default nextConfig;
