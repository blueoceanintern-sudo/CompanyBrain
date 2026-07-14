import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Tells Next.js to root the standalone output at the monorepo root so that
  // server.js ends up at <monorepo-root>/apps/web/server.js, which the
  // Dockerfile runner stage then copies correctly.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  typedRoutes: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
}

export default nextConfig
