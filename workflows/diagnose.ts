/**
 * Diagnostic tool: screenshot login page and dump DOM to find real selectors.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAGNOSE] starting...');
  const watchdog = startWatchdog({ hardTimeoutMs: 120_000 });
  const session = await launchBrowser();

  try {
    const { page } = session;

    // Navigate to login
    console.log('[DIAGNOSE] navigating to login page...');
    await page.goto('https://www.jiandaoyun.com/xiongzhan', {
      waitUntil: 'networkidle',
      timeout: 30000,
    }).catch(() => {
      console.log('[DIAGNOSE] networkidle timeout, continuing...');
    });

    await waitForStableDOM(page);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/diagnose-login.png', fullPage: true });
    console.log('[DIAGNOSE] screenshot saved to screenshots/diagnose-login.png');

    // Dump all input elements
    const inputs = await page.$$eval('input', els =>
      els.map(el => ({
        type: el.getAttribute('type'),
        placeholder: el.getAttribute('placeholder'),
        name: el.getAttribute('name'),
        id: el.getAttribute('id'),
        class: el.getAttribute('class'),
        'data-testid': el.getAttribute('data-testid'),
        'aria-label': el.getAttribute('aria-label'),
        autocomplete: el.getAttribute('autocomplete'),
        outerHTML: el.outerHTML.substring(0, 200),
      }))
    );
    console.log('[DIAGNOSE] Inputs found:');
    inputs.forEach((inp, i) => console.log(`  Input ${i}:`, JSON.stringify(inp, null, 2)));

    // Dump all buttons
    const buttons = await page.$$eval('button', els =>
      els.map(el => ({
        text: el.textContent?.trim().substring(0, 50),
        type: el.getAttribute('type'),
        id: el.getAttribute('id'),
        class: el.getAttribute('class'),
        'data-testid': el.getAttribute('data-testid'),
        'aria-label': el.getAttribute('aria-label'),
        outerHTML: el.outerHTML.substring(0, 200),
      }))
    );
    console.log('[DIAGNOSE] Buttons found:');
    buttons.forEach((btn, i) => console.log(`  Button ${i}:`, JSON.stringify(btn, null, 2)));

    // Dump all links that look login-related
    const links = await page.$$eval('a, span[role="button"], div[role="button"]', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.includes('登录') || text.includes('注册') || text.includes('密码');
      }).map(el => ({
        text: el.textContent?.trim().substring(0, 50),
        tag: el.tagName,
        class: el.getAttribute('class'),
        id: el.getAttribute('id'),
        'data-testid': el.getAttribute('data-testid'),
        'aria-label': el.getAttribute('aria-label'),
        outerHTML: el.outerHTML.substring(0, 300),
      }))
    );
    console.log('[DIAGNOSE] Login-related elements:');
    links.forEach((link, i) => console.log(`  Link ${i}:`, JSON.stringify(link, null, 2)));

    // Get page title and URL
    console.log('[DIAGNOSE] Page title:', await page.title());
    console.log('[DIAGNOSE] Current URL:', page.url());

    // Dump any form elements
    const forms = await page.$$eval('form', els =>
      els.map(el => ({
        action: el.getAttribute('action'),
        method: el.getAttribute('method'),
        id: el.getAttribute('id'),
        innerHTML: el.innerHTML.substring(0, 500),
      }))
    );
    console.log('[DIAGNOSE] Forms:', forms.length);
    forms.forEach((f, i) => console.log(`  Form ${i}:`, JSON.stringify(f, null, 2)));

    console.log('[DIAGNOSE] complete');
  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
  }
}

main().catch(err => {
  console.error('[DIAGNOSE] error:', err);
  process.exit(1);
});
