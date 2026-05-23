/**
 * 直接检查订单明细表数据
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
  console.log('[CHECK DETAIL TABLE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // 点击订单明细表
    await page.locator('.tree-node').filter({ hasText: '订单明细表' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`订单明细表数据:\n${text.substring(0, 2000)}`);

    // 检查是否有数据
    const hasData = text.includes('ORD') || text.includes('智能手机') || text.includes('2') || text.includes('2999');
    console.log(`\n有数据记录: ${hasData ? '✓' : '✗ (空表)'}`);

    await page.screenshot({ path: 'screenshots/check-detail-table.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
