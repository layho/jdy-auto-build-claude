/**
 * 诊断显示字段配置 - 找到正确的点击目标
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
  console.log('[DIAG DISPLAY FIELDS V2]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const orderDetailField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    await orderDetailField.click({ force: true });
    console.log('✓ 已点击订单明细');
    await page.waitForTimeout(2000);

    // Find ALL clickable elements in the property panel with "显示" or "个字段" text
    const configPanel = page.locator('.fx-design-field-config').first();

    // Look for elements containing "个字段"
    const fieldCountElements = configPanel.locator(':has-text("个字段")');
    const fceCount = await fieldCountElements.count();
    console.log(`\n包含"个字段"的元素: ${fceCount}个`);
    for (let i = 0; i < fceCount; i++) {
      const el = fieldCountElements.nth(i);
      const tag = await el.evaluate(e => e.tagName);
      const cls = await el.getAttribute('class').catch(() => '');
      const text = await el.innerText().catch(() => '');
      const visible = await el.isVisible().catch(() => false);
      console.log(`  [${i}] tag=${tag} class="${cls?.substring(0, 100)}" visible=${visible} text="${text?.substring(0, 100)}"`);
    }

    // Try clicking each element containing "显示字段" or "个字段"
    for (let i = 0; i < fceCount; i++) {
      const el = fieldCountElements.nth(i);
      const visible = await el.isVisible().catch(() => false);
      if (visible) {
        console.log(`\n尝试点击 [${i}]...`);
        await el.click({ force: true });
        await page.waitForTimeout(1500);

        // Check if a popover appeared
        const popover = await page.evaluate(() => {
          const pops = [...document.querySelectorAll('[class*="popover"], [class*="x-biz-multi-field"], [class*="field-selector"]')]
            .filter(el => !!(el as HTMLElement).offsetParent);
          return pops.map(p => ({
            class: (p as HTMLElement).className?.substring(0, 200),
            text: (p as HTMLElement).innerText?.trim()?.substring(0, 500),
          }));
        });

        if (popover.length > 0) {
          console.log(`  弹窗已打开!`);
          console.log(`  内容: ${JSON.stringify(popover, null, 2)}`);

          // Check for checkboxes in the popover
          const cbs = await page.evaluate(() => {
            const pops = [...document.querySelectorAll('[class*="popover"], [class*="x-biz-multi-field"], [class*="field-selector"]')]
              .filter(el => !!(el as HTMLElement).offsetParent);
            const checkboxes = [...pops[0]?.querySelectorAll('input[type="checkbox"]') || []];
            return checkboxes.map((cb, idx) => ({
              index: idx,
              checked: (cb as HTMLInputElement).checked,
              disabled: (cb as HTMLInputElement).disabled,
              label: cb.closest('label')?.textContent?.trim() || cb.parentElement?.textContent?.trim() || '',
            }));
          });
          console.log(`  复选框: ${JSON.stringify(cbs, null, 2)}`);

          await page.screenshot({ path: 'screenshots/diag-display-v2-popover.png', fullPage: true });
          break;
        } else {
          console.log(`  没有弹窗`);
        }
      }
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
