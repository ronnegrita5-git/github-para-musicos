/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      resolveAlias: {
        // Deshabilitar PostCSS si es necesario
      },
    },
  },
}

export default nextConfig
