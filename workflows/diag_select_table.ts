/**
 * 诊断：找到"选择主表"的可点击元素
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 找"选择主表"可交互元素...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const formEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await formEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await formEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 点击关联数据 widget
    await page.locator('li.form-edit-widget-label:has-text("关联数据")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 找所有文本为"选择主表"的元素
    const el = page.locator('text=选择主表').first();
    const count = await page.locator('text=选择主表').count();
    console.log(`[DIAG] "选择主表"文本元素数: ${count}`);

    if (count > 0) {
      // 获取该元素的tag, class, 和父元素信息
      for (let i = 0; i < count; i++) {
        const elem = page.locator('text=选择主表').nth(i);
        const tag = await elem.evaluate(el => el.tagName).catch(() => '?');
        const cls = await elem.evaluate(el => (el as HTMLElement).className).catch(() => '');
        const parentTag = await elem.evaluate(el => el.parentElement?.tagName || '').catch(() => '');
        const parentCls = await elem.evaluate(el => el.parentElement?.className || '').catch(() => '');
        const grandparentTag = await elem.evaluate(el => el.parentElement?.parentElement?.tagName || '').catch(() => '');
        const grandparentCls = await elem.evaluate(el => el.parentElement?.parentElement?.className || '').catch(() => '');
        console.log(`  [${i}] <${tag}> class="${cls?.substring(0, 100)}"`);
        console.log(`       parent: <${parentTag}> class="${parentCls?.substring(0, 100)}"`);
        console.log(`       grandparent: <${grandparentTag}> class="${grandparentCls?.substring(0, 100)}"`);
      }

      // 尝试点击第一个
      const first = page.locator('text=选择主表').first();
      console.log('\n[DIAG] 点击"选择主表"...');
      await first.click({ force: true });
      await page.waitForTimeout(2000);

      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 点击后页面内容:\n${text.substring(0, 1500)}`);
      await page.screenshot({ path: 'screenshots/diag-after-select-table.png', fullPage: true });
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
