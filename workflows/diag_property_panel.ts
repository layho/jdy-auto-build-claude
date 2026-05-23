/**
 * 诊断：查看右侧属性面板中"选择主表"的DOM结构
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 属性面板DOM结构...\n');
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

    // 找到包含"选择主表"的容器中的所有 input, select, button
    const allInputs = await page.$$eval('input, select, textarea, button', els => {
      const results: any[] = [];
      for (const el of els) {
        const parent = el.closest('[class*="property"], [class*="setting"], [class*="fx-property"]');
        if (parent) {
          results.push({
            tag: el.tagName,
            type: (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el instanceof HTMLButtonElement) ? el.type || '' : '',
            placeholder: (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) ? el.placeholder || '' : '',
            value: (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) ? el.value || '' : '',
            outerHTML: el.outerHTML?.substring(0, 200),
          });
        }
      }
      return results;
    });

    console.log('[DIAG] 属性面板内的input/select/button:');
    allInputs.forEach(el => console.log(`  <${el.tag}> type=${el.type} placeholder="${el.placeholder}" value="${el.value}"\n    html: ${el.outerHTML}`));

    // 用Playwright查找所有 select/dropdown 相关元素
    const selectEls = page.locator('[class*="x-select"], [class*="select-container"], [class*="dropdown"]');
    const count = await selectEls.count();
    console.log(`\n[DIAG] Select/下拉组件数量: ${count}`);

    for (let i = 0; i < count && i < 10; i++) {
      const el = selectEls.nth(i);
      const cls = await el.getAttribute('class').catch(() => '');
      const text = await el.innerText().catch(() => '');
      const visible = await el.isVisible().catch(() => false);
      console.log(`  [${i}] class="${cls}" visible=${visible} text="${text?.substring(0, 80)}"`);
    }

    // 截图
    await page.screenshot({ path: 'screenshots/diag-property-panel.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
