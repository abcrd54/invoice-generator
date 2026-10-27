import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Chromium untuk render PDF tidak boleh di-bundle; binernya ikut dideploy apa adanya
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // Kunci = glob route; "[token]" akan dibaca sebagai character class, jadi pakai **
  outputFileTracingIncludes: {
    '/p/**/pdf': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/whatsapp': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
};

export default nextConfig;
