import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/download", destination: "https://meu-ritmo-lite.silva-joao-232334.workers.dev/" },
      { source: "/download/:path*", destination: "https://meu-ritmo-lite.silva-joao-232334.workers.dev/:path*" },
    ];
  },
};

export default nextConfig;
