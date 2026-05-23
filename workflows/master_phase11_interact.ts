/**
 * Phase 11 - 深入交互每个模块的创建流程
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
  console.log('[PHASE 11 - DEEP INTERACT]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 智能助手 - 选择表单触发 ======
    console.log('====== 1. 智能助手 - 选择表单触发 ======');
    await page.goto(`${BASE}/app_trigger`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建智能助手")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Fill name
    const nameInput = page.locator('.fx-automation-trigger-config-dialog input').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('自动同步订单');
      await page.waitForTimeout(500);
      console.log('✓ 命名: 自动同步订单');
    }

    // Click "表单触发" radio/card
    const formTrigger = page.locator('[class*="dialog"] :has-text("表单触发")').first();
    await formTrigger.click({ force: true });
    await page.waitForTimeout(1500);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('选择表单触发后:');
    console.log(text.substring(0, 2000));

    // Select trigger form
    const formSelector = page.locator('[class*="dialog"] :has-text("请选择触发表单")').first();
    if (await formSelector.count() > 0) {
      await formSelector.click({ force: true });
      await page.waitForTimeout(2000);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n选择触发表单后:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master11-smart-assistant.png', fullPage: true });

    // Close dialog
    const cancelBtn = page.locator('.fx-automation-trigger-config-dialog .dialog-footer button:has-text("取消")').first();
    if (await cancelBtn.count() > 0) await cancelBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // ====== 2. 数据工厂 - 关闭引导，查看编辑器 ======
    console.log('\n\n====== 2. 数据工厂 ======');
    await page.goto(`${BASE}/app_etl`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建数据流")').first().click({ force: true });
    await page.waitForTimeout(4000);
    await waitForStableDOM(page);

    // Close guide dialog
    const guideClose = page.locator('[class*="guide-dialog"] .dialog-header-buttons button').first();
    if (await guideClose.count() > 0) {
      await guideClose.click({ force: true });
      await page.waitForTimeout(1500);
      console.log('✓ 关闭引导');
    }

    // Get the canvas/editor HTML
    const editorHTML = await page.evaluate(() => {
      const canvas = document.querySelector('[class*="canvas"], [class*="flow"], [class*="etl"], [class*="dag"], [class*="graph"]');
      return canvas ? (canvas as HTMLElement).outerHTML?.substring(0, 3000) : 'canvas not found';
    });
    console.log('数据工厂编辑器:');
    console.log(editorHTML?.substring(0, 2000));

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n页面文本:\n${text.substring(0, 1500)}`);

    await page.screenshot({ path: 'screenshots/master11-data-factory.png', fullPage: true });

    // Go back to list
    await page.goto(`${BASE}/app_etl`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // ====== 3. 数据推送 ======
    console.log('\n\n====== 3. 数据推送 ======');
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建数据推送")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Click form selector
    const pushFormSelector = page.locator('[class*="create-dialog"] :has-text("请选择")').first();
    if (await pushFormSelector.count() > 0) {
      await pushFormSelector.click({ force: true });
      await page.waitForTimeout(2000);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('数据推送 - 选择推送表单:');
    console.log(text.substring(0, 2000));

    // Select a form
    const orderForm = page.locator('[class*="popover"] [class*="option"]:has-text("订单管理"), [class*="popover"] [class*="item"]:has-text("订单管理")').first();
    if (await orderForm.count() > 0) {
      await orderForm.click({ force: true });
      await page.waitForTimeout(1500);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n选择订单管理后:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master11-data-push.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
