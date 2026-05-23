/**
 * Phase 8L - 添加指标 → 命名 → 保存聚合表
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
  console.log('[PHASE 8L - ADD METRICS & SAVE]\n');
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

    // Add dimension: 下单日期
    await page.locator('button:has-text("添加维度")').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dateOpt = page.locator('[class*="select-dropdown"] [class*="option"]:has-text("下单日期")').first();
    if (await dateOpt.count() > 0) {
      await dateOpt.click({ force: true });
      await page.waitForTimeout(1000);
    }
    // Close dropdown
    await page.locator('.config-layout-header:has-text("维度")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // ====== Add metric ======
    console.log('Step 1: 添加指标...');
    const addMetricBtn = page.locator('button:has-text("添加指标")').first();
    console.log(`  添加指标按钮: ${await addMetricBtn.count()}个`);

    if (await addMetricBtn.count() > 0) {
      await addMetricBtn.click({ force: true });
      await page.waitForTimeout(2000);

      // Check what appears after clicking
      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log('点击添加指标后:');
      console.log(text.substring(0, 2500));

      await page.screenshot({ path: 'screenshots/master8L-add-metric.png', fullPage: true });

      // Look for metric options/dropdown
      const metricOptions = await page.evaluate(() => {
        // Look for select dropdowns
        const dropdowns = document.querySelectorAll('[class*="select-dropdown"], [class*="select-open"]');
        const results: any[] = [];
        dropdowns.forEach(d => {
          const items = d.querySelectorAll('[class*="option"], [class*="item"], li');
          items.forEach(item => {
            const text = (item as HTMLElement).innerText?.trim();
            if (text && text.length > 0 && text.length < 60) {
              results.push(text);
            }
          });
        });
        return results;
      });

      console.log(`\n指标选项 (${metricOptions.length}个):`);
      metricOptions.forEach((o: any) => console.log(`  "${o}"`));

      // Try to select a COUNT metric - usually "记录数" or field names
      // The metric dropdown might show: COUNT, SUM, AVG or field names
      if (metricOptions.length === 0) {
        // Maybe it's a different interaction - check for dialogs
        const dialogs = await page.evaluate(() => {
          return [...document.querySelectorAll('[class*="dialog"]')].map(d => ({
            class: (d as HTMLElement).className?.substring(0, 100),
            text: (d as HTMLElement).innerText?.substring(0, 1000),
          }));
        });
        console.log('\n对话框:');
        dialogs.forEach((d: any) => console.log(`  ${d.class}\n  ${d.text?.substring(0, 500)}`));
      }
    }

    // Also get the full HTML for the metric area
    const metricHTML = await page.evaluate(() => {
      const metricSection = document.querySelector('.fx-aggregate-view-edit-config-layout:has(.config-layout-label:has-text("指标"))');
      return metricSection ? (metricSection as HTMLElement).innerHTML?.substring(0, 3000) : 'not found';
    });
    console.log('\n指标区域HTML:');
    console.log(metricHTML);

    // ====== Try saving anyway ======
    console.log('\nStep 2: 命名并保存...');

    // Rename the aggregate table
    const nameInput = page.locator('.fx-title-editor input').first();
    if (await nameInput.count() > 0) {
      await nameInput.click({ force: true });
      await page.waitForTimeout(500);
      await nameInput.fill('订单销售统计');
      await page.waitForTimeout(500);
      // Press Enter to confirm
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      console.log('  ✓ 命名: 订单销售统计');
    }

    const saveBtn = page.locator('.aggregate-view-edit-nav-right button:has-text("保存")').first();
    await saveBtn.click({ force: true });
    await page.waitForTimeout(4000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log('保存后:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master8L-saved.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
