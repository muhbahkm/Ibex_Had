import type { NextConfig } from 'next';

type WebpackResolveLike = {
  extensionAlias?: Record<string, readonly string[]>;
};

type WebpackConfigLike = {
  resolve: WebpackResolveLike;
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  webpack(config) {
    const typedConfig = config as WebpackConfigLike;
    typedConfig.resolve.extensionAlias = {
      ...typedConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return typedConfig;
  },
};

export default nextConfig;
