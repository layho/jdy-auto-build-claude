/**
 * Phase 8f - 配置维度/指标并保存聚合表
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
  console.log('[PHASE 8f - CONFIGURE & SAVE]\n');
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

    // Select 订单管理
    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd1 = page.locator('[class*="popover"]:has-text("订单管理")').first();
    await dd1.locator('.entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // Select 订单明细表 as sub-form
    const subFormArea = page.locator('[class*="entry-select-combo"]').last();
    await subFormArea.locator('button').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd2 = page.locator('[class*="popover"]:has-text("订单明细表")').first();
    await dd2.locator('.entry-item:has-text("订单明细表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // Confirm data source dialog
    const confirmBtn = page.locator('.dialog-footer button:has-text("确定")').first();
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    console.log('数据源已配置，开始配置维度和指标...\n');

    // ====== Get full config panel ======
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('当前页面:');
    console.log(text.substring(0, 1500));

    // ====== Step 1: Configure dimensions ======
    console.log('\n====== 配置维度 ======');
    const dimBtn = page.locator('button:has-text("配置维度")').first();
    console.log(`配置维度按钮: ${await dimBtn.count()}个`);

    if (await dimBtn.count() > 0) {
      await dimBtn.click({ force: true });
      await page.waitForTimeout(2500);

      text = await page.locator('body').first().innerText().catch(() => '');
      console.log('维度配置弹窗:');
      console.log(text.substring(0, 2000));

      await page.screenshot({ path: 'screenshots/master8f-dim-dialog.png', fullPage: true });

      // Look for field selector dialog
      const dimDialogHTML = await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[class*="dialog"], [class*="modal"], [class*="popover"], [class*="drawer"]');
        for (const d of dialogs) {
          const text = (d as HTMLElement).innerText?.trim();
          if (text?.includes('维度') || text?.includes('字段') || text?.includes('选择')) {
            return {
              class: (d as HTMLElement).className?.substring(0, 150),
              html: (d as HTMLElement).innerHTML?.substring(0, 5000),
            };
          }
        }
        return null;
      });

      if (dimDialogHTML) {
        console.log(`\n维度弹窗: ${dimDialogHTML.class}`);
        console.log(dimDialogHTML.html?.substring(0, 4000));
      }

      // Try to find field checkboxes or tree nodes
      const fieldOptions = await page.evaluate(() => {
        const checks = document.querySelectorAll('input[type="checkbox"]');
        return [...checks].slice(0, 30).map(cb => {
          const parent = cb.closest('label, div, li, [class*="item"], [class*="node"]');
          const text = parent ? (parent as HTMLElement).innerText?.trim()?.substring(0, 80) : '';
          return {
            text,
            checked: (cb as HTMLInputElement).checked,
            visible: cb.getBoundingClientRect().width > 0,
          };
        }).filter(c => c.text && c.visible);
      });

      console.log(`\n可选字段 (${fieldOptions.length}个):`);
      fieldOptions.forEach((f: any) => console.log(`  ${f.checked ? '☑' : '☐'} "${f.text}"`));

      // Try clicking on field items to select them
      if (fieldOptions.length > 0) {
        // Select 产品名称 and 下单日期
        for (const fieldName of ['产品名称', '下单日期', '关联客户']) {
          const fieldItem = page.locator('[class*="node-content"]:has-text("' + fieldName + '")').first();
          if (await fieldItem.count() > 0) {
            console.log(`\n尝试选择: ${fieldName}`);
            await fieldItem.click({ force: true });
            await page.waitForTimeout(1000);
          }
        }
      }
    }

    // ====== Full page state after dimension config ======
    await page.screenshot({ path: 'screenshots/master8f-final.png', fullPage: true });

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n最终状态:');
    console.log(text.substring(0, 2000));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
