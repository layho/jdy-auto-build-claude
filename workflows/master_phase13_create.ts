/**
 * Phase 13 - 正确创建智能助手和数据推送
 * 关键：点击 .x-biz-dropdown-label 打开表单选择器
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const BASE = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#';

async function main() {
  console.log('[PHASE 13 - CREATE MODULES]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 创建数据推送 ======
    console.log('====== 1. 创建数据推送 ======');
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建数据推送")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Click the dropdown label to open form selector
    const pushDropdown = page.locator('.fx-app-data-push-create-dialog .x-biz-dropdown-label').first();
    console.log(`  下拉标签: ${await pushDropdown.count()}个`);
    await pushDropdown.click({ force: true });
    await page.waitForTimeout(2000);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('打开表单选择器后:');
    console.log(text.substring(0, 1500));

    // Select 订单管理
    const pushFormEntry = page.locator('[class*="popover"] .entry-item:has-text("订单管理")').first();
    if (await pushFormEntry.count() > 0 && await pushFormEntry.isVisible().catch(() => false)) {
      await pushFormEntry.click({ force: true });
      await page.waitForTimeout(1500);
      console.log('  ✓ 选择: 订单管理');
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n选择后:');
    console.log(text.substring(0, 1500));

    // Check if 确定 is enabled now
    const pushOkBtn = page.locator('.fx-app-data-push-create-dialog .dialog-footer button:has-text("确定")').first();
    const pushOkDisabled = await pushOkBtn.isDisabled().catch(() => true);
    console.log(`  确定按钮 disabled: ${pushOkDisabled}`);

    if (!pushOkDisabled) {
      await pushOkBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      console.log('  ✓ 数据推送已创建!');
    }

    await page.screenshot({ path: 'screenshots/master13-push-created.png', fullPage: true });

    // ====== 2. 创建智能助手 ======
    console.log('\n\n====== 2. 创建智能助手 ======');
    await page.goto(`${BASE}/app_trigger`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建智能助手")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Fill name
    const smartNameInput = page.locator('.fx-automation-trigger-config-dialog .trigger-name-input input').first();
    if (await smartNameInput.count() > 0) {
      await smartNameInput.fill('自动同步订单数据');
      await page.waitForTimeout(500);
      console.log('✓ 命名: 自动同步订单数据');
    }

    // 表单触发 should already be selected (class: selected)
    // Click the form selector dropdown
    const smartDropdown = page.locator('.fx-automation-trigger-config-dialog .form-selector .x-biz-dropdown-label').first();
    console.log(`  表单选择器: ${await smartDropdown.count()}个`);
    await smartDropdown.click({ force: true });
    await page.waitForTimeout(2000);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('打开表单选择器后:');
    console.log(text.substring(0, 1500));

    // Select 订单管理
    const smartFormEntry = page.locator('[class*="popover"] .entry-item:has-text("订单管理")').first();
    if (await smartFormEntry.count() > 0 && await smartFormEntry.isVisible().catch(() => false)) {
      await smartFormEntry.click({ force: true });
      await page.waitForTimeout(1500);
      console.log('  ✓ 选择触发表单: 订单管理');
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n选择后:');
    console.log(text.substring(0, 1500));

    // Check if 确定 is enabled
    const smartOkBtn = page.locator('.fx-automation-trigger-config-dialog .dialog-footer button:has-text("确定")').first();
    const smartOkDisabled = await smartOkBtn.isDisabled().catch(() => true);
    console.log(`  确定按钮 disabled: ${smartOkDisabled}`);

    if (!smartOkDisabled) {
      await smartOkBtn.click({ force: true });
      await page.waitForTimeout(4000);
      await waitForStableDOM(page);
      console.log('  ✓ 智能助手已创建!');
    }

    await page.screenshot({ path: 'screenshots/master13-smart-created.png', fullPage: true });

    // ====== 检查创建后的列表 ======
    console.log('\n\n====== 3. 检查列表 ======');

    // Check data push list
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);
    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('数据推送列表:');
    console.log(text.substring(0, 1200));

    // Check smart assistant list
    await page.goto(`${BASE}/app_trigger`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);
    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n智能助手列表:');
    console.log(text.substring(0, 1200));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
