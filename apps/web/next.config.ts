import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@voxelplace/styles', '@voxelplace/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@phosphor-icons/react'],
  },
  turbopack: {},
}

export default nextConfig
