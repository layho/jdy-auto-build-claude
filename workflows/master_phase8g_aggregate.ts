/**
 * Phase 8g - 选择维度字段并完成聚合表保存
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
  console.log('[PHASE 8g - DIMENSION FIELDS & SAVE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Navigate, create, select data source ======
    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Select 订单管理
    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd1 = page.locator('[class*="popover"]').filter({ hasText: '订单管理' }).first();
    await dd1.locator('.entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // Select 订单明细表 sub-form
    const subFormArea = page.locator('[class*="entry-select-combo"]').last();
    await subFormArea.locator('button').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd2 = page.locator('[class*="popover"]').filter({ hasText: '订单明细表' }).first();
    await dd2.locator('.entry-item:has-text("订单明细表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // Confirm data source
    await page.locator('.dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Open dimension config dialog ======
    console.log('Step 1: 打开维度配置...');
    await page.locator('button:has-text("配置维度")').first().click({ force: true });
    await page.waitForTimeout(2500);

    // ====== Click the first field selector ======
    console.log('Step 2: 选择维度字段...');
    const fieldSelectors = page.locator('.x-biz-field-selector');
    console.log(`  字段选择器: ${await fieldSelectors.count()}个`);

    // Click the first field selector to open dropdown
    const firstSelector = fieldSelectors.first();
    await firstSelector.click({ force: true });
    await page.waitForTimeout(2000);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('打开字段选择器后:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master8g-field-dropdown.png', fullPage: true });

    // Look for field options in dropdown
    const fieldOptions = await page.evaluate(() => {
      // Search in popovers, dropdowns, select menus
      const containers = document.querySelectorAll('[class*="popover"], [class*="dropdown"], [class*="select-dropdown"], [class*="option-list"], [class*="menu"]');
      const results: any[] = [];
      for (const c of containers) {
        const items = c.querySelectorAll('[class*="option"], [class*="item"], li, [class*="node"]');
        for (const item of items) {
          const text = (item as HTMLElement).innerText?.trim();
          if (text && text.length > 0 && text.length < 50) {
            const rect = item.getBoundingClientRect();
            if (rect.width > 30) {
              results.push({
                text,
                class: (item as HTMLElement).className?.substring(0, 80),
                container: (c as HTMLElement).className?.substring(0, 60),
              });
            }
          }
        }
      }
      return results;
    });

    console.log(`\n字段选项 (${fieldOptions.length}个):`);
    const seen = new Set<string>();
    fieldOptions.forEach((f: any) => {
      if (!seen.has(f.text)) {
        seen.add(f.text);
        console.log(`  "${f.text}" [${f.container}]`);
      }
    });

    // Try to select a field
    if (fieldOptions.length > 0) {
      // Find and click 下单日期 or 关联客户
      for (const fieldName of ['下单日期', '关联客户', '订单编号']) {
        const option = page.locator(`[class*="option"]:has-text("${fieldName}"), [class*="item"]:has-text("${fieldName}"), li:has-text("${fieldName}")`).first();
        if (await option.count() > 0 && await option.isVisible().catch(() => false)) {
          console.log(`\n点击: ${fieldName}`);
          await option.click({ force: true });
          await page.waitForTimeout(1500);
          break;
        }
      }
    }

    await page.screenshot({ path: 'screenshots/master8g-after-field-select.png', fullPage: true });

    // ====== Check final state ======
    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n选择字段后:');
    console.log(text.substring(0, 2000));

    // ====== Try to save the aggregate table ======
    console.log('\nStep 3: 尝试保存...');

    // First close dimension dialog if open
    const dimOk = page.locator('.fx-dimension-config-multi-dialog button:has-text("确定")').first();
    if (await dimOk.count() > 0 && await dimOk.isVisible().catch(() => false)) {
      await dimOk.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // Click save button
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.count() > 0) {
      console.log('  点击保存...');
      await saveBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('保存后:');
    console.log(text.substring(0, 1500));

    await page.screenshot({ path: 'screenshots/master8g-saved.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
