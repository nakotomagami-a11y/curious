/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/lab/curious',
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: ['@curious/shared', '@curious/game-logic'],
  webpack: (config) => {
    // Support GLSL shader imports
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      type: 'asset/source',
    });
    return config;
  },
};

module.exports = nextConfig;
