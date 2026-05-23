/**
 * Phase 8e - 完成聚合表创建全流程
 * 选择数据源 → 选择子表单 → 配置维度/指标 → 保存
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
  console.log('[PHASE 8e - COMPLETE AGGREGATE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Step 1: Open aggregate table creation ======
    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Step 2: Open form selector and select 订单管理 ======
    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);

    const dropdown = page.locator('[class*="popover"]:has-text("订单管理")').first();
    await dropdown.locator('.entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(2000);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('选择订单管理后:');
    console.log(text.substring(0, 800));

    await page.screenshot({ path: 'screenshots/master8e-1-select-main.png', fullPage: true });

    // ====== Step 3: Select sub-form 订单明细表 ======
    console.log('\nStep 3: 选择子表单...');
    const subFormSelector = page.locator('[class*="entry-select-combo"]:has-text("选择子表单") button, button:has-text("选择子表单")').first();
    console.log(`  子表单选择器: ${await subFormSelector.count()}个`);

    // Click the subform selector
    const subFormArea = page.locator('[class*="entry-select-combo"]').last();
    const subFormBtn = subFormArea.locator('button').first();
    if (await subFormBtn.count() > 0) {
      await subFormBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('点击子表单选择后:');
    console.log(text.substring(0, 800));

    // Try to select 订单明细表
    const subDropdown = page.locator('[class*="popover"]:has-text("订单明细表")').first();
    const subEntry = subDropdown.locator('.entry-item:has-text("订单明细表")').first();
    if (await subEntry.count() > 0) {
      await subEntry.click({ force: true });
      await page.waitForTimeout(2000);
      console.log('  ✓ 已选择子表单: 订单明细表');
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('选择子表单后:');
    console.log(text.substring(0, 800));

    await page.screenshot({ path: 'screenshots/master8e-2-select-sub.png', fullPage: true });

    // ====== Step 4: Click 确定 to confirm data source ======
    console.log('\nStep 4: 确认数据源...');
    const confirmBtn = page.locator('.dialog-footer button:has-text("确定"), .fx-aggregate-source-select-dialog button:has-text("确定")').first();
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      console.log('  ✓ 已确认数据源');
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('确认数据源后:');
    console.log(text.substring(0, 1500));

    await page.screenshot({ path: 'screenshots/master8e-3-confirm-source.png', fullPage: true });

    // ====== Step 5: Configure dimensions and metrics ======
    console.log('\nStep 5: 配置维度和指标...');

    // Look for the configuration panel
    const configPanel = await page.evaluate(() => {
      const panels = document.querySelectorAll('[class*="aggregate"], [class*="config"], [class*="panel"], [class*="right"]');
      const results: any[] = [];
      panels.forEach(p => {
        const rect = p.getBoundingClientRect();
        const text = (p as HTMLElement).innerText?.trim()?.substring(0, 500);
        if (text && rect.width > 100) {
          results.push({
            class: (p as HTMLElement).className?.substring(0, 100),
            text,
          });
        }
      });
      return results;
    });

    console.log('配置面板:');
    configPanel.forEach((p: any) => console.log(`  ${p.class}: "${p.text?.substring(0, 200)}"`));

    // Get full page info
    const fullHTML = await page.evaluate(() => {
      const main = document.querySelector('[class*="aggregate-table"], [class*="aggregate"], .app-setting');
      return main ? (main as HTMLElement).innerHTML?.substring(0, 5000) : document.body.innerHTML?.substring(0, 5000);
    });
    console.log('\n聚合表页面HTML:');
    console.log(fullHTML?.substring(0, 4000));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
