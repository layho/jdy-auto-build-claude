/**
 * Phase 8j - 诊断"添加维度"后的UI状态
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const AGGREGATE_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_aggregate';

async function main() {
  console.log('[PHASE 8j - DIAG DIMENSION]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd1 = page.locator('[class*="popover"]').filter({ hasText: '订单管理' }).first();
    await dd1.locator('.entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(2000);

    await page.locator('.dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Click 添加维度 ======
    console.log('点击添加维度...');
    await page.locator('button:has-text("添加维度")').first().click({ force: true });
    await page.waitForTimeout(3000);

    // Get FULL page state
    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log('页面状态:');
    console.log(text.substring(0, 2500));

    // Get all config panel HTML
    const configHTML = await page.evaluate(() => {
      const config = document.querySelector('.fx-aggregate-view-edit-config');
      return config ? (config as HTMLElement).innerHTML?.substring(0, 8000) : 'not found';
    });
    console.log('\n====== Config Panel HTML ======');
    console.log(configHTML?.substring(0, 6000));

    // Check for all dialogs
    const dialogs = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="dialog"]')].map(d => ({
        class: (d as HTMLElement).className?.substring(0, 100),
        text: (d as HTMLElement).innerText?.substring(0, 500),
      }));
    });
    console.log('\n====== 对话框 ======');
    dialogs.forEach((d: any) => {
      console.log(`  ${d.class}`);
      console.log(`  ${d.text?.substring(0, 300)}`);
    });

    await page.screenshot({ path: 'screenshots/master8j-dim-state.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
