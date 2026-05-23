/**
 * Phase 8h - 完成维度配置 + 指标配置 + 保存聚合表
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
  console.log('[PHASE 8h - FINALIZE AGGREGATE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Navigate, create, select data source (same as before) ======
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

    const subFormArea = page.locator('[class*="entry-select-combo"]').last();
    await subFormArea.locator('button').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd2 = page.locator('[class*="popover"]').filter({ hasText: '订单明细表' }).first();
    await dd2.locator('.entry-item:has-text("订单明细表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    await page.locator('.dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Open and configure dimensions ======
    await page.locator('button:has-text("配置维度")').first().click({ force: true });
    await page.waitForTimeout(2500);

    // Select first field: 下单日期 (from main form)
    const firstSelector = page.locator('.x-biz-field-selector').first();
    await firstSelector.click({ force: true });
    await page.waitForTimeout(1500);
    const dateField = page.locator('[class*="popup"] [class*="option"]:has-text("下单日期"), [class*="popup"] li:has-text("下单日期")').first();
    if (await dateField.count() > 0 && await dateField.isVisible().catch(() => false)) {
      await dateField.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('✓ 选择维度1: 下单日期');
    }

    // Select second field: 产品名称 (from sub-form)
    const secondSelector = page.locator('.x-biz-field-selector').nth(1);
    await secondSelector.click({ force: true });
    await page.waitForTimeout(1500);

    // Check what fields are available
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('第二个选择器字段:');
    console.log(text.substring(0, 2000));

    // Look for sub-form fields
    const subFields = page.locator('[class*="popup"] [class*="option"]:has-text("产品名称"), [class*="popup"] li:has-text("产品名称")').first();
    if (await subFields.count() > 0 && await subFields.isVisible().catch(() => false)) {
      await subFields.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('✓ 选择维度2: 产品名称');
    } else {
      // Try other fields
      const altFields = ['产品名称', '数量', '金额', '单价'];
      for (const f of altFields) {
        const opt = page.locator('[class*="popup"] [class*="option"]:has-text("' + f + '"), [class*="popup"] li:has-text("' + f + '")').first();
        if (await opt.count() > 0 && await opt.isVisible().catch(() => false)) {
          await opt.click({ force: true });
          await page.waitForTimeout(1000);
          console.log(`✓ 选择维度2: ${f}`);
          break;
        }
      }
    }

    await page.screenshot({ path: 'screenshots/master8h-dim-filled.png', fullPage: true });

    // ====== Confirm dimension dialog ======
    console.log('\n确认维度配置...');
    const dimOkBtn = page.locator('.fx-dimension-config-multi-dialog .dialog-footer button:has-text("确定")').first();
    if (await dimOkBtn.count() > 0) {
      await dimOkBtn.click({ force: true });
      await page.waitForTimeout(2500);
      await waitForStableDOM(page);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('维度确认后:');
    console.log(text.substring(0, 1500));

    await page.screenshot({ path: 'screenshots/master8h-dim-confirmed.png', fullPage: true });

    // ====== Check for metrics configuration ======
    console.log('\n查找指标配置...');
    const metricBtn = page.locator('button:has-text("配置指标")').first();
    console.log(`  配置指标按钮: ${await metricBtn.count()}个`);

    // Scroll to see full config
    const fullConfig = await page.evaluate(() => {
      const config = document.querySelector('.fx-aggregate-view-edit-config');
      if (config) {
        return {
          scrollHeight: config.scrollHeight,
          clientHeight: config.clientHeight,
          text: (config as HTMLElement).innerText?.substring(0, 2000),
        };
      }
      return null;
    });
    console.log('  配置面板:');
    if (fullConfig) console.log(`  scrollHeight=${fullConfig.scrollHeight}, clientHeight=${fullConfig.clientHeight}`);
    console.log(fullConfig?.text || '未找到');

    // ====== Try to save ======
    console.log('\n====== 保存聚合表 ======');
    const saveBtn = page.locator('.aggregate-view-edit-nav-right button:has-text("保存")').first();
    if (await saveBtn.count() > 0) {
      console.log('  点击保存...');
      await saveBtn.click({ force: true });
      await page.waitForTimeout(4000);
      await waitForStableDOM(page);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('保存后:');
    console.log(text.substring(0, 1500));

    await page.screenshot({ path: 'screenshots/master8h-saved.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
