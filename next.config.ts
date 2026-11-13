import type { NextConfig } from "next";

const appDownloadOrigin = "https://meu-ritmo-lite.silva-joao-232334.workers.dev";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/download", destination: `${appDownloadOrigin}/` },
      { source: "/download/:path*", destination: `${appDownloadOrigin}/:path*` },
      { source: "/download.css", destination: `${appDownloadOrigin}/download.css` },
      { source: "/theme.js", destination: `${appDownloadOrigin}/theme.js` },
      { source: "/handoff.js", destination: `${appDownloadOrigin}/handoff.js` },
      { source: "/releases/:path*", destination: `${appDownloadOrigin}/releases/:path*` },
    ];
  },
};

export default nextConfig;
