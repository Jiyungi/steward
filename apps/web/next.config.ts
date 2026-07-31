import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: [
    "@steward/config",
    "@steward/contracts",
    "@steward/db",
    "@steward/providers",
    "@steward/ui",
  ],
  experimental: {
    externalDir: true,
    useTypeScriptCli: true,
  },
};

export default nextConfig;
