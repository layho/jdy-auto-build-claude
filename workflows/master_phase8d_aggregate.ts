/**
 * Phase 8d - 精确选择表单并完成聚合表创建
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
  console.log('[PHASE 8d - COMPLETE AGGREGATE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click 新建聚合表
    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Click the add button to open form dropdown
    await page.locator('.x-biz-entry-select-combo button.add-btn').first().click({ force: true });
    await page.waitForTimeout(2000);

    // ====== Get the dropdown HTML structure ======
    const dropdownHTML = await page.evaluate(() => {
      // Find the dropdown that contains form names
      const dropdowns = document.querySelectorAll('[class*="dropdown"]');
      for (const d of dropdowns) {
        const text = (d as HTMLElement).innerText?.trim();
        if (text?.includes('客户信息') && text?.includes('产品信息')) {
          return {
            outerHTML: (d as HTMLElement).outerHTML?.substring(0, 5000),
            innerHTML: (d as HTMLElement).innerHTML?.substring(0, 4000),
          };
        }
      }
      // Also check popovers
      const popovers = document.querySelectorAll('[class*="popover"]');
      for (const p of popovers) {
        const text = (p as HTMLElement).innerText?.trim();
        if (text?.includes('客户信息')) {
          return {
            type: 'popover',
            outerHTML: (p as HTMLElement).outerHTML?.substring(0, 5000),
            innerHTML: (p as HTMLElement).innerHTML?.substring(0, 4000),
          };
        }
      }
      return { error: 'dropdown not found' };
    });

    console.log('Dropdown HTML:');
    console.log(dropdownHTML.outerHTML || dropdownHTML.innerHTML || JSON.stringify(dropdownHTML));

    // ====== Try clicking with specific selectors ======
    console.log('\n====== 尝试不同的点击方式 ======');

    // Method 1: Click by text content within the dropdown
    const dropdown = page.locator('[class*="dropdown"]:has-text("客户信息"), [class*="popover"]:has-text("客户信息")').first();
    if (await dropdown.count() > 0) {
      console.log('\nMethod 1: 在dropdown内点击 订单管理');

      // Find the specific entry-item divs inside the dropdown
      const entryItems = dropdown.locator('.entry-item');
      const count = await entryItems.count();
      console.log(`  找到 ${count} 个 entry-item`);

      for (let i = 0; i < count; i++) {
        const item = entryItems.nth(i);
        const text = await item.innerText().catch(() => '');
        console.log(`  [${i}] "${text}"`);
      }

      // Click 订单管理
      const orderEntry = dropdown.locator('.entry-item:has-text("订单管理")').first();
      if (await orderEntry.count() > 0) {
        console.log('  点击 订单管理...');
        await orderEntry.click({ force: true });
        await page.waitForTimeout(2000);

        const afterText = await page.locator('body').first().innerText().catch(() => '');
        const hasChanged = afterText.includes('订单管理') && !afterText.includes('客户信息');
        console.log(`  页面变化: ${hasChanged ? '✓' : '✗'}`);
        console.log(`  当前文本: ${afterText.substring(0, 800)}`);
      }
    }

    await page.screenshot({ path: 'screenshots/master8d-after-select.png', fullPage: true });

    // ====== Method 2: Try clicking the label/value wrapper area first ======
    console.log('\nMethod 2: 尝试点击 x-biz-dropdown-label');
    const dropdownLabel = page.locator('.x-biz-dropdown-label').first();
    if (await dropdownLabel.count() > 0) {
      const labelHTML = await dropdownLabel.evaluate(el => (el as HTMLElement).outerHTML?.substring(0, 2000));
      console.log(`  Label HTML: ${labelHTML}`);
    }

    // ====== Method 3: Try using page.evaluate to directly select ======
    console.log('\nMethod 3: 使用JS直接选择表单');
    await page.evaluate(() => {
      // Find all entry items in dropdowns/popovers
      const items = document.querySelectorAll('.entry-item');
      console.log(`Found ${items.length} entry items via JS`);
      items.forEach((item, i) => {
        console.log(`  [${i}] ${(item as HTMLElement).innerText} - clickable: ${item.click ? 'yes' : 'no'}`);
      });
      // Click the 订单管理 item
      for (const item of items) {
        if ((item as HTMLElement).innerText?.trim() === '订单管理') {
          (item as HTMLElement).click();
          console.log('Clicked 订单管理 via JS');
          break;
        }
      }
    });
    await page.waitForTimeout(2000);

    const afterJSText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`JS点击后:\n${afterJSText.substring(0, 1000)}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
