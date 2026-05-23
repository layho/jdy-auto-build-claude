/**
 * Click "编辑" to enter form design mode, then find field controls.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM, smartLocate } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAGNOSE6] starting...');
  const watchdog = startWatchdog({ hardTimeoutMs: 120_000 });
  const session = await launchBrowser();

  try {
    const { page } = session;

    await login(page);
    await navigateToApp(page, '爱马仕');

    console.log('[DIAGNOSE6] Before edit mode, URL:', page.url());
    await waitForStableDOM(page);
    await page.waitForTimeout(1500);

    // Click the "编辑" button
    const editBtn = await smartLocate(page, [
      "button:has-text('编辑')",
      '.menu-icon-text-button:has-text("编辑")',
    ]);
    await editBtn.click();
    console.log('[DIAGNOSE6] clicked 编辑');

    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    console.log('[DIAGNOSE6] After edit mode, URL:', page.url());

    await page.screenshot({ path: 'screenshots/diagnose-edit-mode.png', fullPage: true });
    console.log('[DIAGNOSE6] screenshot saved');

    // Find ALL buttons in edit mode
    const allButtons = await page.$$eval('button', els =>
      els.map(el => ({
        text: (el.textContent?.trim() || '').substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 150),
        title: el.getAttribute('title')?.substring(0, 80),
      }))
    );
    console.log('[DIAGNOSE6] All buttons in edit mode:');
    allButtons.forEach((btn, i) => console.log(`  ${i}:`, JSON.stringify(btn)));

    // Find field-related controls
    const fieldControls = await page.$$eval('[class*="field"], [class*="control"], [class*="widget"], [class*="add"]', els =>
      els.filter(el => {
        const cls = el.getAttribute('class') || '';
        return cls.includes('add') || cls.includes('field') || cls.includes('control') || cls.includes('widget');
      }).slice(0, 20).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 150),
      }))
    );
    console.log('[DIAGNOSE6] Field-related in edit mode:');
    fieldControls.forEach((el, i) => console.log(`  ${i}:`, JSON.stringify(el)));

    // Find all text containing 拖拽/添加/字段
    const allText = await page.$$eval('*', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        return /[拖拽|添加|字段|控件]/.test(text) && el.children.length === 0;
      }).slice(0, 15).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 100),
      }))
    );
    console.log('[DIAGNOSE6] Drag/add/field text elements:');
    allText.forEach((el, i) => console.log(`  ${i}:`, JSON.stringify(el)));

  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
  }
}

main().catch(err => {
  console.error('[DIAGNOSE6] error:', err);
  process.exit(1);
});
