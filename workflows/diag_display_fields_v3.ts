/**
 * 诊断显示字段选择器 - 点击正确的按钮
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
  console.log('[DIAG DISPLAY V3]\n');
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

    // Click the "显示 N 个字段" button inside 显示字段 section
    const displayBtn = page.locator('.config-content button:has-text("个字段")').first();
    const dbCount = await displayBtn.count();
    console.log(`显示字段按钮: ${dbCount}个`);

    if (dbCount > 0) {
      await displayBtn.click({ force: true });
      console.log('✓ 已点击显示字段按钮');
      await page.waitForTimeout(2000);
    } else {
      // Try clicking the config-content div directly
      const configDiv = page.locator('.config-content:has-text("个字段")').first();
      if (await configDiv.count() > 0) {
        await configDiv.click({ force: true });
        console.log('✓ 已点击 config-content');
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'screenshots/diag-display-v3.png', fullPage: true });

    // Check for field selector popover
    const fsState = await page.evaluate(() => {
      const popover = document.querySelector('.x-biz-multi-field-selector-popover');
      if (!popover || !(popover as HTMLElement).offsetParent) {
        // Check all visible popovers
        const allVisible = [...document.querySelectorAll('[class*="popover"]')]
          .filter(el => !!(el as HTMLElement).offsetParent)
          .map(el => ({
            class: (el as HTMLElement).className?.substring(0, 150),
            text: (el as HTMLElement).innerText?.trim()?.substring(0, 300),
          }));
        return { error: 'no field selector popover', allVisiblePopovers: allVisible };
      }

      const checkboxes = [...popover.querySelectorAll('input[type="checkbox"]')];
      return {
        found: true,
        checkboxCount: checkboxes.length,
        checkboxes: checkboxes.map((cb, i) => {
          // Find the label text by looking at parent elements
          let node: Element | null = cb;
          let text = '';
          for (let j = 0; j < 5 && node; j++) {
            const siblings = [...node.parentElement?.children || []];
            for (const sib of siblings) {
              if (sib !== node && sib.tagName !== 'INPUT') {
                const t = (sib as HTMLElement).innerText?.trim();
                if (t && t.length > text.length) text = t;
              }
            }
            node = node.parentElement;
          }
          return {
            index: i,
            checked: (cb as HTMLInputElement).checked,
            disabled: (cb as HTMLInputElement).disabled,
            context: text.substring(0, 60),
          };
        }),
        popoverText: (popover as HTMLElement).innerText?.trim()?.substring(0, 500),
      };
    });

    console.log(`\n字段选择器: ${JSON.stringify(fsState, null, 2)}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
