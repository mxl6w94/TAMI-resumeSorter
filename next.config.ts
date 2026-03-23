import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse uses Node.js binary modules that must not be bundled by webpack
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
