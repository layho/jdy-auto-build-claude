/**
 * Try create-item.create-empty click and handle navigation.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 测试 create-item 点击...');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await navigateToApp(page, '爱马仕');
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Click "新建表单" to open dialog
    await page.locator('.entry-item:has-text("新建表单")').first().click({ force: true });
    await page.waitForTimeout(1000);

    // Click "创建空白表单" using correct class
    console.log('[DIAG] 点击 .create-item.create-empty...');
    const blankItem = page.locator('.create-item.create-empty').first();
    await blankItem.waitFor({ state: 'visible', timeout: 5000 });
    await blankItem.click();
    console.log('[DIAG] 已点击');

    // Wait for possible navigation
    await page.waitForTimeout(3000);
    console.log(`[DIAG] URL: ${page.url()}`);

    // Check for any dialog to name the form
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 页面内容:\n${text.substring(0, 600)}`);

    // Check for form editor elements
    const editorEls = await page.$$eval('[class*="field-widget"], [class*="form-edit"], [class*="form-design"], .fx-field, .tree-node', els =>
      els.map(el => ({
        class: (el as HTMLElement).className?.substring(0, 80),
        visible: (el as HTMLElement).offsetParent !== null,
      }))
    );
    console.log('[DIAG] 编辑器元素:');
    editorEls.forEach(e => console.log(`  ${e.class} visible=${e.visible}`));

    await page.screenshot({ path: 'screenshots/after-create-blank.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
