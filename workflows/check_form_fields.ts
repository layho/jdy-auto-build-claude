/**
 * 检查表单编辑器中当前字段配置，确认子表是否还存在
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[CHECK FORM FIELDS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入表单编辑器 ======
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // 进入编辑器
    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== 获取所有字段 ======
    const fields = await page.evaluate(() => {
      const fieldLayouts = [...document.querySelectorAll('.fx-field-layout.field')];
      return fieldLayouts.map(el => {
        const innerText = (el as HTMLElement).innerText?.trim() || '';
        const cls = (el as HTMLElement).className?.substring(0, 200);
        // Find field type indicator
        const widgetLabel = el.closest('.form-edit-area')?.querySelector('.fx-field-layout.field');
        return {
          class: cls,
          text: innerText.substring(0, 100),
          rect: JSON.stringify(el.getBoundingClientRect()),
        };
      });
    });

    console.log(`字段数量: ${fields.length}`);
    fields.forEach((f, i) => {
      console.log(`  [${i}] class="${f.class}" text="${f.text}"`);
    });

    // Also list all field labels from the widget panel
    const widgetLabels = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('li.form-edit-widget-label')];
      return labels.map(el => ({
        text: (el as HTMLElement).innerText?.trim(),
        class: (el as HTMLElement).className?.substring(0, 100),
      }));
    });
    console.log(`\n工具栏字段: ${JSON.stringify(widgetLabels.map(w => w.text))}`);

    await page.screenshot({ path: 'screenshots/check-form-fields.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
