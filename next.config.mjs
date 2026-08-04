/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client', 'argon2'],
};

export default nextConfig;
