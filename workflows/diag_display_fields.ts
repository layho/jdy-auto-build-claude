/**
 * 诊断显示字段配置 - 检查是否有view/edit和add模式的区分
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
  console.log('[DIAG DISPLAY FIELDS]\n');
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

    // ====== Click "显示 N 个字段" to open field selector popover ======
    const displayFieldRow = page.locator('.fx-relatedform-selection-layout [class*="config-content"]:has-text("个字段")').first();
    if (await displayFieldRow.count() === 0) {
      // Try alternative selector
      const alt = page.locator('[class*="config-content"]:has-text("个字段")').first();
      console.log(`备选选择器: count=${await alt.count()}`);
    }

    console.log(`displayFieldRow count: ${await displayFieldRow.count()}`);

    if (await displayFieldRow.count() > 0) {
      await displayFieldRow.click({ force: true });
      console.log('✓ 已打开显示字段选择器');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/diag-display-1-popover.png', fullPage: true });

    // Check popover content
    const popoverState = await page.evaluate(() => {
      // Find any visible popover/dropdown
      const popovers = [...document.querySelectorAll('[class*="popover"], [class*="dropdown"], [class*="selector"], [class*="picker"], [class*="popper"]')]
        .filter(el => !!(el as HTMLElement).offsetParent);

      return popovers.map(p => ({
        class: (p as HTMLElement).className?.substring(0, 200),
        text: (p as HTMLElement).innerText?.trim()?.substring(0, 2000),
        html: (p as HTMLElement).innerHTML?.substring(0, 5000),
        visible: true,
      }));
    });

    console.log(`弹窗内容:\n${JSON.stringify(popoverState, null, 2).substring(0, 5000)}`);

    // Check checkboxes in any visible popover
    const cbState = await page.evaluate(() => {
      const popovers = [...document.querySelectorAll('[class*="popover"], [class*="dropdown"], [class*="selector"], [class*="picker"], [class*="popper"]')]
        .filter(el => !!(el as HTMLElement).offsetParent);

      const allCheckboxes: any[] = [];
      for (const popover of popovers) {
        const checkboxes = [...popover.querySelectorAll('input[type="checkbox"]')];
        for (const cb of checkboxes) {
          const label = cb.closest('label')?.textContent?.trim()
            || (cb as HTMLElement).parentElement?.textContent?.trim()
            || '';
          allCheckboxes.push({
            checked: (cb as HTMLInputElement).checked,
            disabled: (cb as HTMLInputElement).disabled,
            label: label.substring(0, 80),
          });
        }
      }
      return allCheckboxes;
    });

    console.log(`\n所有可见弹窗中的复选框 (${cbState.length}个):`);
    cbState.forEach((cb, i) => console.log(`  [${i}] checked=${cb.checked} disabled=${cb.disabled} label="${cb.label}"`));

    await page.screenshot({ path: 'screenshots/diag-display-2-checkboxes.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
