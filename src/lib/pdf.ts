import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';

/** Chrome lokal untuk development (Windows / macOS / Linux). Bisa di-override dengan CHROME_PATH. */
function localChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => p && existsSync(p));
}

async function launch(): Promise<Browser> {
  const local = process.env.VERCEL ? undefined : localChrome();
  if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ['--no-sandbox'] });

  // Serverless (Vercel): Chromium ringan dari @sparticuz/chromium
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true, args: chromium.args });
}

/**
 * Render halaman share (/p/<token>) menjadi PDF. Ukuran & orientasi kertas diambil dari
 * aturan @page di CSS (A4 portrait untuk invoice, A4 landscape untuk Form Request Payment).
 */
export async function renderPdf(pageUrl: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30_000 });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function pdfFilename(number: string): string {
  return `${number.replace(/[\\/]/g, '-')}.pdf`;
}
