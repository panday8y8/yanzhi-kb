import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 用 127.0.0.1 访问 dev 服务时，Next 默认会拦截 dev 资源；显式放行本机地址
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {},
}

export default nextConfig
