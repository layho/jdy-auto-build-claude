/**
 * Phase 8m - 最终完成：选择指标变量 → 确认 → 保存
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
  console.log('[PHASE 8m - FINAL SAVE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Navigate and create ======
    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Select data source
    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd1 = page.locator('[class*="popover"]').filter({ hasText: '订单管理' }).first();
    await dd1.locator('.entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.locator('.dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Add dimension
    await page.locator('button:has-text("添加维度")').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dateOpt = page.locator('[class*="select-dropdown"] [class*="option"]:has-text("下单日期")').first();
    if (await dateOpt.count() > 0) {
      await dateOpt.click({ force: true });
      await page.waitForTimeout(1000);
    }
    await page.locator('.config-layout-header:has-text("维度")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // ====== Add metric ======
    console.log('Step 1: 添加指标...');
    await page.locator('button:has-text("添加指标")').first().click({ force: true });
    await page.waitForTimeout(2500);

    // The formula dialog is open. Click "数据条数" in 聚合变量
    const dataCount = page.locator('[class*="aggregate-formula"] :has-text("数据条数")').first();
    console.log(`  数据条数元素: ${await dataCount.count()}个`);

    // Try clicking 数据条数 in the aggregate variable panel
    const aggVars = page.locator('[class*="aggregate-formula-edit-dialog"]').first();
    const varEl = aggVars.locator('text=数据条数').first();
    if (await varEl.count() > 0) {
      await varEl.click({ force: true });
      await page.waitForTimeout(1500);
      console.log('  ✓ 点击数据条数');
    }

    await page.screenshot({ path: 'screenshots/master8m-metric-selected.png', fullPage: true });

    // Check the formula
    const formulaText = await page.evaluate(() => {
      const dlg = document.querySelector('[class*="aggregate-formula-edit-dialog"]');
      return dlg ? (dlg as HTMLElement).innerText?.substring(0, 1000) : 'not found';
    });
    console.log(`  公式状态:\n${formulaText}`);

    // Click 确定 on the formula dialog
    const metricOk = page.locator('[class*="aggregate-formula-edit-dialog"] .dialog-footer button:has-text("确定")').first();
    if (await metricOk.count() > 0) {
      await metricOk.click({ force: true });
      await page.waitForTimeout(2000);
      console.log('  ✓ 确认指标');
    }

    // ====== Rename and save ======
    console.log('\nStep 2: 命名并保存...');

    // Rename
    const nameSpan = page.locator('.fx-title-editor span').first();
    if (await nameSpan.count() > 0) {
      await nameSpan.click({ force: true });
      await page.waitForTimeout(500);
      const nameInput = page.locator('.fx-title-editor input').first();
      await nameInput.fill('订单统计');
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      console.log('  ✓ 命名: 订单统计');
    }

    // Save
    const saveBtn = page.locator('.aggregate-view-edit-nav-right button:has-text("保存")').first();
    await saveBtn.click({ force: true });
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n保存后页面:');
    console.log(text.substring(0, 2000));

    // Check URL to see if saved (probably redirects to list)
    console.log(`\n当前URL: ${page.url()}`);

    await page.screenshot({ path: 'screenshots/master8m-final.png', fullPage: true });

    // ====== Verify: go back to aggregate list ======
    console.log('\nStep 3: 验证聚合表列表...');
    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const listText = await page.locator('body').first().innerText().catch(() => '');
    console.log('聚合表列表:');
    console.log(listText.substring(0, 1500));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
