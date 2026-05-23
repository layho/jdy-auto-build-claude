/**
 * 检查字段选择器弹窗是否有模式切换tab
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
  console.log('[CHECK POPOVER TABS]\n');
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
    await page.waitForTimeout(2000);

    // Click the display button
    const displayBtn = page.locator('.config-content button:has-text("个字段")').first();
    await displayBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // Get full popover HTML to check for tabs
    const popoverFull = await page.evaluate(() => {
      const popover = document.querySelector('.x-biz-multi-field-selector-popover');
      if (!popover || !(popover as HTMLElement).offsetParent) return { error: 'no popover' };

      return {
        innerHTML: (popover as HTMLElement).innerHTML?.substring(0, 5000),
        outerHTML: (popover as HTMLElement).outerHTML?.substring(0, 5000),
        // Find tabs
        tabs: [...popover.querySelectorAll('[class*="tab"], [role="tab"]')].map(t => ({
          class: (t as HTMLElement).className?.substring(0, 120),
          text: (t as HTMLElement).innerText?.trim(),
          selected: t.classList.contains('active') || t.getAttribute('aria-selected') === 'true',
        })),
        // All buttons
        buttons: [...popover.querySelectorAll('button')].map(b => ({
          class: (b as HTMLElement).className?.substring(0, 120),
          text: (b as HTMLElement).innerText?.trim(),
        })),
      };
    });

    console.log(JSON.stringify(popoverFull, null, 2));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
