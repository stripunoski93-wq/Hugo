import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profilePath = path.join(__dirname, '..', 'data', 'browser-profile');

let browserContext = null;

export async function initBrowserContext() {
  fs.mkdirSync(profilePath, { recursive: true });
  try {
    const browser = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      channel: 'chrome',
      viewport: { width: 1400, height: 900 },
      ignoreHTTPSErrors: true
    });
    browserContext = browser;
    console.log('Browser context initialized');
    return browser;
  } catch (error) {
    console.error('Failed to initialize browser context:', error.message);
    return null;
  }
}

export async function openAccountPage(url) {
  if (!browserContext) {
    console.error('Browser context not initialized');
    return null;
  }
  try {
    const page = await browserContext.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    return page;
  } catch (error) {
    console.error(`Failed to open ${url}:`, error.message);
    return null;
  }
}

export async function checkServiceHealth(serviceUrl, checkElement = null) {
  if (!browserContext) return 'Not available';
  try {
    const page = await browserContext.newPage();
    await page.goto(serviceUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });
    
    if (checkElement) {
      const exists = await page.locator(checkElement).count() > 0;
      await page.close();
      return exists ? 'Logged in' : 'Not logged in';
    }
    
    const url = page.url();
    await page.close();
    return url.includes('login') || url.includes('signin') ? 'Not logged in' : 'Logged in';
  } catch (error) {
    return 'Not available';
  }
}

export async function closeBrowser() {
  if (browserContext) {
    await browserContext.close();
    browserContext = null;
  }
}

export { profilePath };
