/**
 * Phase 8k - 最终完成聚合表：选择维度 → 配置指标 → 保存
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
  console.log('[PHASE 8k - FINAL AGGREGATE]\n');
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

    // Select 订单管理 only
    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);
    const dd1 = page.locator('[class*="popover"]').filter({ hasText: '订单管理' }).first();
    await dd1.locator('.entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(2000);

    await page.locator('.dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Add dimension: click "添加维度" then select from dropdown ======
    console.log('Step 1: 添加维度...');
    await page.locator('button:has-text("添加维度")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // The dropdown should be open now, select "下单日期"
    // Look for dropdown options
    const dropdownOptions = await page.evaluate(() => {
      const sel = document.querySelector('.x-select-open, .x-select-dropdown, [class*="select-dropdown"]');
      if (!sel) return [];
      const items = sel.querySelectorAll('[class*="option"], [class*="item"], li');
      return [...items].map(i => ({
        text: (i as HTMLElement).innerText?.trim(),
        class: (i as HTMLElement).className?.substring(0, 80),
      })).filter(i => i.text && i.text.length > 0 && i.text.length < 50);
    });

    console.log(`  下拉选项 (${dropdownOptions.length}个):`);
    dropdownOptions.forEach((o: any) => console.log(`    "${o.text}" ${o.class}`));

    // Click "下单日期" in the dropdown
    const dateOpt = page.locator('[class*="select-dropdown"] [class*="option"]:has-text("下单日期"), [class*="select-open"] [class*="option"]:has-text("下单日期")').first();
    if (await dateOpt.count() > 0) {
      await dateOpt.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('  ✓ 选择: 下单日期');
    }

    // Close dropdown by clicking elsewhere
    const configHeader = page.locator('.config-layout-header:has-text("维度")').first();
    await configHeader.click({ force: true });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'screenshots/master8k-dim-selected.png', fullPage: true });

    // ====== Scroll to find metrics ======
    console.log('\nStep 2: 查找指标配置...');
    await page.evaluate(() => {
      const config = document.querySelector('.fx-aggregate-view-edit-config');
      if (config) config.scrollTop = config.scrollHeight;
    });
    await page.waitForTimeout(1500);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('滚动后:');
    console.log(text.substring(0, 2500));

    // Get all config sections
    const sections = await page.evaluate(() => {
      const config = document.querySelector('.fx-aggregate-view-edit-config');
      if (!config) return [];
      // Get ALL text content
      const allText = (config as HTMLElement).innerText || '';
      // Get section headers
      const headers = [...config.querySelectorAll('.config-layout-label')].map(h => (h as HTMLElement).innerText?.trim());
      return { headers, allText: allText.substring(0, 2000) };
    });
    console.log(`\n配置区域: ${(sections as any).headers?.join(', ')}`);
    console.log(`全部文本:\n${(sections as any).allText}`);

    // Check if there's a metrics section
    const metricSection = page.locator('.fx-aggregate-view-edit-config-layout:has(.config-layout-label:has-text("指标"))').first();
    console.log(`\n指标区域: ${await metricSection.count()}个`);

    if (await metricSection.count() === 0) {
      // Maybe metrics appear after dimension is configured
      // Or maybe it's below and we need to scroll more
      const fullConfig = await page.evaluate(() => {
        const config = document.querySelector('.fx-aggregate-view-edit-config');
        if (!config) return null;
        return {
          scrollHeight: config.scrollHeight,
          clientHeight: config.clientHeight,
          children: [...config.children].map(c => (c as HTMLElement).className?.substring(0, 100)),
        };
      });
      console.log(`\nConfig panel: scrollHeight=${(fullConfig as any)?.scrollHeight}, clientHeight=${(fullConfig as any)?.clientHeight}`);
      console.log(`Children: ${(fullConfig as any)?.children?.join(', ')}`);
    }

    await page.screenshot({ path: 'screenshots/master8k-scrolled.png', fullPage: true });

    // ====== Try to save ======
    console.log('\nStep 3: 保存...');
    const saveBtn = page.locator('.aggregate-view-edit-nav-right button:has-text("保存")').first();
    await saveBtn.click({ force: true });
    await page.waitForTimeout(4000);
    await waitForStableDOM(page);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('保存结果:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master8k-saved.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
