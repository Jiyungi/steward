import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  poweredByHeader: false,
  transpilePackages: ["@steward/contracts", "@steward/ui"],
};

export default nextConfig;
