/**
 * Deeper diagnostic: check iframes, shadow DOM, wait longer.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAGNOSE2] starting...');
  const watchdog = startWatchdog({ hardTimeoutMs: 120_000 });
  const session = await launchBrowser();

  try {
    const { page } = session;

    await page.goto('https://www.jiandaoyun.com/xiongzhan', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait longer
    console.log('[DIAGNOSE2] waiting 5s...');
    await page.waitForTimeout(5000);

    // Check URL after redirects
    console.log('[DIAGNOSE2] Current URL:', page.url());
    console.log('[DIAGNOSE2] Page title:', await page.title());

    // Check iframes
    const frames = page.frames();
    console.log('[DIAGNOSE2] Frame count:', frames.length);
    for (const frame of frames) {
      console.log(`  Frame: url=${frame.url()}, name=${frame.name()}`);
    }

    // Try locating input by placeholder directly
    const loc1 = page.locator("input[placeholder='手机号/邮箱']");
    console.log('[DIAGNOSE2] input[placeholder=手机号/邮箱] count:', await loc1.count());

    const loc2 = page.locator("input[placeholder*='邮箱']");
    console.log('[DIAGNOSE2] input[placeholder*=邮箱] count:', await loc2.count());

    const loc3 = page.locator('.input-inner');
    console.log('[DIAGNOSE2] .input-inner count:', await loc3.count());

    const loc4 = page.locator('input');
    console.log('[DIAGNOSE2] input count:', await loc4.count());

    const loc5 = page.locator('button.login-btn');
    console.log('[DIAGNOSE2] button.login-btn count:', await loc5.count());

    // Dump body HTML snippet
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
    console.log('[DIAGNOSE2] Body HTML (first 1000 chars):');
    console.log(bodyHTML);

  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
  }
}

main().catch(err => {
  console.error('[DIAGNOSE2] error:', err);
  process.exit(1);
});
