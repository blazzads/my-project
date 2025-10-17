/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["localhost"],
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8000",
  },
  // Fix workspace root warning
  outputFileTracingRoot: "enterprise-proposal-system/frontend",
  // Disable swcMinify warning (not needed in Next.js 14+)
  experimental: {
    optimizeCss: true,
  },
};

module.exports = nextConfig;
