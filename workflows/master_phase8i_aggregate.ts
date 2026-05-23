/**
 * Phase 8i - 简化聚合表：只用订单管理，配置维度+指标，保存
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
  console.log('[PHASE 8i - SIMPLE AGGREGATE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== Create new aggregate table ======
    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Select ONLY 订单管理 (no sub-form) ======
    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd1 = page.locator('[class*="popover"]').filter({ hasText: '订单管理' }).first();
    await dd1.locator('.entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // Confirm WITHOUT selecting sub-form
    await page.locator('.dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('数据源确认后:');
    console.log(text.substring(0, 1200));

    await page.screenshot({ path: 'screenshots/master8i-source-confirmed.png', fullPage: true });

    // ====== Configure dimension ======
    console.log('\n====== 添加维度 ======');
    await page.locator('button:has-text("添加维度")').first().click({ force: true });
    await page.waitForTimeout(2500);

    // Check the dimension dialog structure (single form, no sub-form)
    const dimDialogHTML = await page.evaluate(() => {
      const dlg = document.querySelector('[class*="dimension"][class*="dialog"], [class*="dimension-config"]');
      return dlg ? (dlg as HTMLElement).innerText?.substring(0, 1000) : 'not found';
    });
    console.log('维度弹窗内容:');
    console.log(dimDialogHTML);

    // Select field from the field selector
    const fieldSelector = page.locator('.x-biz-field-selector').first();
    await fieldSelector.click({ force: true });
    await page.waitForTimeout(1500);

    // Get available fields
    const fields = await page.evaluate(() => {
      const options = document.querySelectorAll('[class*="popup"] [class*="option"], [class*="popup"] [class*="item"]');
      return [...options].slice(0, 20).map(o => ({
        text: (o as HTMLElement).innerText?.trim(),
        class: (o as HTMLElement).className?.substring(0, 60),
      })).filter(o => o.text && o.text.length > 0 && o.text.length < 50);
    });
    console.log(`\n可用字段 (${fields.length}个):`);
    fields.forEach(f => console.log(`  "${f.text}"`));

    // Select 下单日期 as dimension
    const dateOption = page.locator('[class*="popup"] [class*="option"]:has-text("下单日期"), [class*="popup"] li:has-text("下单日期")').first();
    if (await dateOption.count() > 0 && await dateOption.isVisible().catch(() => false)) {
      await dateOption.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('✓ 选择维度: 下单日期');
    }

    // Confirm dimension dialog
    const dimConfirmBtn = page.locator('[class*="dialog"] .dialog-footer button:has-text("确定")').first();
    if (await dimConfirmBtn.count() > 0) {
      await dimConfirmBtn.click({ force: true });
      await page.waitForTimeout(2500);
      await waitForStableDOM(page);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n维度确认后:');
    console.log(text.substring(0, 1500));

    await page.screenshot({ path: 'screenshots/master8i-dim-confirmed.png', fullPage: true });

    // ====== Look for metrics configuration ======
    console.log('\n====== 查找指标配置 ======');
    const fullConfigText = await page.evaluate(() => {
      const config = document.querySelector('.fx-aggregate-view-edit-config');
      return config ? (config as HTMLElement).innerText?.substring(0, 2000) : 'not found';
    });
    console.log(fullConfigText);

    // Check for all config sections
    const sections = await page.evaluate(() => {
      const headers = document.querySelectorAll('.config-layout-header .config-layout-label');
      return [...headers].map(h => (h as HTMLElement).innerText?.trim());
    });
    console.log(`\n配置区域: ${sections.join(', ')}`);

    // Scroll down in config panel
    await page.evaluate(() => {
      const config = document.querySelector('.fx-aggregate-view-edit-config');
      if (config) config.scrollTop = config.scrollHeight;
    });
    await page.waitForTimeout(1000);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n滚动后:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master8i-scrolled.png', fullPage: true });

    // ====== Try to save ======
    console.log('\n====== 保存 ======');
    const saveBtn = page.locator('.aggregate-view-edit-nav-right button:has-text("保存")').first();
    await saveBtn.click({ force: true });
    await page.waitForTimeout(4000);
    await waitForStableDOM(page);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('保存结果:');
    console.log(text.substring(0, 1500));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
