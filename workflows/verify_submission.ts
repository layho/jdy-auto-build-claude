/**
 * 验证提交：打开最新记录检查子表数据
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
  console.log('[VERIFY SUBMISSION]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 点击最新记录行 (ORD-20260523-010)
    const latestRow = page.locator('tr:has-text("ORD-20260523-010")').first();
    if (await latestRow.count() > 0) {
      await latestRow.click({ force: true });
      console.log('✓ 已点击最新记录');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const detailText = await page.locator('body').first().innerText().catch(() => '');
      console.log(`\n记录详情:\n${detailText.substring(0, 2000)}`);

      // 检查子表数据
      const subtableCheck = await page.evaluate(() => {
        const subtable = document.querySelector('.fx-related-form');
        if (!subtable) return { error: 'no subtable in detail' };

        const rows = [...subtable.querySelectorAll('.fx-related-form-row')];
        const cells = [...subtable.querySelectorAll('.related-form-cell')];

        return {
          rowCount: rows.length,
          cellCount: cells.length,
          innerText: (subtable as HTMLElement).innerText?.trim(),
          cellsHTML: cells.map(c => c.innerHTML?.substring(0, 200)),
        };
      });

      console.log(`\n子表数据: ${JSON.stringify(subtableCheck, null, 2)}`);
    }

    await page.screenshot({ path: 'screenshots/verify-record.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
