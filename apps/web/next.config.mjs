/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@cspr-agentpay/protocol",
    "@cspr-agentpay/casper-adapter",
  ],
};

export default nextConfig;
