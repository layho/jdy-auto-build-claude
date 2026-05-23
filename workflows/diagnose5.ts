/**
 * Find field creation elements inside form editor.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAGNOSE5] starting...');
  const watchdog = startWatchdog({ hardTimeoutMs: 120_000 });
  const session = await launchBrowser();

  try {
    const { page } = session;

    await login(page);
    await navigateToApp(page, '爱马仕');

    console.log('[DIAGNOSE5] Inside app URL:', page.url());
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Screenshot
    await page.screenshot({ path: 'screenshots/diagnose-form-editor.png', fullPage: true });
    console.log('[DIAGNOSE5] screenshot saved');

    // Find all buttons
    const allButtons = await page.$$eval('button', els =>
      els.map(el => ({
        text: (el.textContent?.trim() || '').substring(0, 60),
        class: el.getAttribute('class')?.substring(0, 150),
        title: el.getAttribute('title')?.substring(0, 60),
      }))
    );
    console.log('[DIAGNOSE5] All buttons:');
    allButtons.forEach((btn, i) => console.log(`  ${i}:`, JSON.stringify(btn)));

    // Find ALL elements that might be "add field"
    const addElements = await page.$$eval('*', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        const cls = el.getAttribute('class') || '';
        const title = el.getAttribute('title') || '';
        return (
          text.includes('添加') || text.includes('新增') || text.includes('字段') ||
          text.includes('拖拽') || text.includes('控件') ||
          cls.includes('add-field') || cls.includes('addField') ||
          title.includes('添加') || title.includes('字段')
        );
      }).slice(0, 20).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 150),
        title: el.getAttribute('title')?.substring(0, 80),
      }))
    );
    console.log('[DIAGNOSE5] Add/field-related elements:');
    addElements.forEach((el, i) => console.log(`  ${i}:`, JSON.stringify(el)));

    // Find all draggable items or field controls
    const fieldArea = await page.$$eval('[class*="field"], [class*="control"], [class*="widget"], [class*="form-edit"]', els =>
      els.slice(0, 15).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 150),
      }))
    );
    console.log('[DIAGNOSE5] Field/control elements:');
    fieldArea.forEach((el, i) => console.log(`  ${i}:`, JSON.stringify(el)));

    // Dump the form editor area
    const editorHTML = await page.evaluate(() => {
      const editor = document.querySelector('[class*="form-edit"]') ||
                    document.querySelector('[class*="form-panel"]') ||
                    document.querySelector('[class*="editor"]') ||
                    document.querySelector('[class*="design"]');
      return editor ? editor.innerHTML.substring(0, 2000) : 'no editor found';
    });
    console.log('[DIAGNOSE5] Editor HTML (first 2000 chars):');
    console.log(editorHTML);

  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
  }
}

main().catch(err => {
  console.error('[DIAGNOSE5] error:', err);
  process.exit(1);
});
