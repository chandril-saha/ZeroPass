import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['snarkjs', 'circomlibjs', 'crypto'],
};

export default nextConfig;
