/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-side env vars are automatically available in API routes.
  // Only vars prefixed with NEXT_PUBLIC_ need to be listed here for client access.
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ML_SERVER_URL: process.env.NEXT_PUBLIC_ML_SERVER_URL,
  },
  // Allow the Next.js server to call the local ML backend
  async rewrites() {
    return [];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
    proxyClientMaxBodySize: '100mb',
  },
};

export default nextConfig;
