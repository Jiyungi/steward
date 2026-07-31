import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@steward/config", "@steward/contracts", "@steward/db", "@steward/providers"],
  experimental: {
    externalDir: true,
    useTypeScriptCli: true,
  },
};

export default nextConfig;
