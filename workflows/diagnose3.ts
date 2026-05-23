/**
 * Diagnose post-login dashboard to find app navigation elements.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAGNOSE3] starting...');
  const watchdog = startWatchdog({ hardTimeoutMs: 120_000 });
  const session = await launchBrowser();

  try {
    const { page } = session;

    // Login
    await login(page);

    // Check where we are after login
    console.log('[DIAGNOSE3] Post-login URL:', page.url());
    console.log('[DIAGNOSE3] Page title:', await page.title());

    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Screenshot
    await page.screenshot({ path: 'screenshots/diagnose-dashboard.png', fullPage: true });
    console.log('[DIAGNOSE3] dashboard screenshot saved');

    // Find app-related elements
    const appElements = await page.$$eval('[class*="app"], [class*="App"], [class*="workspace"]', els =>
      els.slice(0, 10).map(el => ({
        tag: el.tagName,
        class: el.getAttribute('class')?.substring(0, 100),
        text: el.textContent?.trim().substring(0, 80),
      }))
    );
    console.log('[DIAGNOSE3] App-related elements:', JSON.stringify(appElements, null, 2));

    // Find all menu/nav items
    const navItems = await page.$$eval('a, [role="menuitem"], [role="tab"], .menu-item, .nav-item, li', els =>
      els.slice(0, 20).map(el => ({
        tag: el.tagName,
        class: el.getAttribute('class')?.substring(0, 100),
        text: el.textContent?.trim().substring(0, 80),
        href: (el as HTMLAnchorElement).href?.substring(0, 100),
      }))
    );
    console.log('[DIAGNOSE3] Nav/menu items:');
    navItems.forEach((item, i) => console.log(`  ${i}:`, JSON.stringify(item)));

    // Find all text content containing 爱马仕 or 进销存
    const targetTexts = await page.$$eval('*', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.includes('爱马仕') || text.includes('进销存');
      }).slice(0, 5).map(el => ({
        tag: el.tagName,
        class: el.getAttribute('class')?.substring(0, 100),
        text: el.textContent?.trim().substring(0, 100),
        outerHTML: el.outerHTML.substring(0, 300),
      }))
    );
    console.log('[DIAGNOSE3] Target app elements:', JSON.stringify(targetTexts, null, 2));

  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
  }
}

main().catch(err => {
  console.error('[DIAGNOSE3] error:', err);
  process.exit(1);
});
