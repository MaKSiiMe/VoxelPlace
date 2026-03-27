import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@voxelplace/styles', '@voxelplace/types'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@phosphor-icons/react'],
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@features': `${__dirname}/features`,
      '@shared':   `${__dirname}/shared`,
    }
    return config
  },
}

export default nextConfig
