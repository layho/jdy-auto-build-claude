/**
 * Diagnose inside 爱马仕 app: find form creation elements.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAGNOSE4] starting...');
  const watchdog = startWatchdog({ hardTimeoutMs: 120_000 });
  const session = await launchBrowser();

  try {
    const { page } = session;

    await login(page);
    await navigateToApp(page, '爱马仕');

    console.log('[DIAGNOSE4] Inside app URL:', page.url());
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Screenshot
    await page.screenshot({ path: 'screenshots/diagnose-app-interior.png', fullPage: true });
    console.log('[DIAGNOSE4] app interior screenshot saved');

    // Find all buttons with text
    const allButtons = await page.$$eval('button', els =>
      els.map(el => ({
        text: el.textContent?.trim().substring(0, 60),
        class: el.getAttribute('class')?.substring(0, 120),
      }))
    );
    console.log('[DIAGNOSE4] All buttons:');
    allButtons.forEach((btn, i) => console.log(`  ${i}:`, JSON.stringify(btn)));

    // Find all links/clickable elements that might create forms
    const createLinks = await page.$$eval('a, span, div, button', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        const cls = el.getAttribute('class') || '';
        return (
          text.includes('创建') || text.includes('新建') || text.includes('表单') ||
          cls.includes('create') || cls.includes('add') || cls.includes('new')
        );
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 60),
        class: el.getAttribute('class')?.substring(0, 120),
      }))
    );
    console.log('[DIAGNOSE4] Create-related elements:');
    createLinks.forEach((el, i) => console.log(`  ${i}:`, JSON.stringify(el)));

    // Find all top-level navigation / actions
    const actions = await page.$$eval('.fx-form-actions *, .form-actions *, .toolbar *, .header-actions *, [class*="action"]', els =>
      els.slice(0, 15).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 60),
        class: el.getAttribute('class')?.substring(0, 120),
      }))
    );
    console.log('[DIAGNOSE4] Action elements:');
    actions.forEach((el, i) => console.log(`  ${i}:`, JSON.stringify(el)));

    // Dump main content area
    const mainHTML = await page.evaluate(() => {
      const main = document.querySelector('[class*="main"]') || document.querySelector('[class*="content"]') || document.body;
      return main.innerHTML.substring(0, 2000);
    });
    console.log('[DIAGNOSE4] Main content HTML (first 2000 chars):');
    console.log(mainHTML);

  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
  }
}

main().catch(err => {
  console.error('[DIAGNOSE4] error:', err);
  process.exit(1);
});
