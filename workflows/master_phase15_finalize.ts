/**
 * Phase 15 - 保存数据推送配置，打开智能助手编辑器
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
  console.log('[PHASE 15 - FINALIZE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Create and save data push with full config ======
    console.log('====== 1. 创建并保存数据推送 ======');
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Delete old ones first if any
    // Create new
    await page.locator('button:has-text("新建数据推送")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.locator('.fx-app-data-push-create-dialog .x-biz-dropdown-label').first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.locator('[class*="popover"] .entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(1000);

    await page.locator('.fx-app-data-push-create-dialog .dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    // Now fill in the server config
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('配置页:');
    console.log(text.substring(0, 2000));

    // Check if there's a dialog still open
    const dialogVisible = await page.locator('[class*="dialog"]:has-text("数据推送")').first().isVisible().catch(() => false);
    console.log(`\n对话框可见: ${dialogVisible}`);

    // Get the full HTML for the config form
    const formHTML = await page.evaluate(() => {
      const dlg = document.querySelector('.fx-app-data-push-create-dialog');
      if (dlg) return (dlg as HTMLElement).innerHTML?.substring(0, 5000);
      // Check if there's a config page outside dialog
      const config = document.querySelector('[class*="data-push"], [class*="push-config"]');
      if (config) return (config as HTMLElement).innerHTML?.substring(0, 5000);
      return 'not found';
    });
    console.log('\nForm HTML:');
    console.log(formHTML?.substring(0, 4000));

    await page.screenshot({ path: 'screenshots/master15-push-config.png', fullPage: true });

    // Fill server URL
    const serverInput = page.locator('[class*="data-push"] input, [class*="push"] input').first();
    if (await serverInput.count() > 0) {
      await serverInput.fill('https://example.com/webhook');
      await page.waitForTimeout(500);
      console.log('✓ 填入服务器地址');
    }

    // Click 保存
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.count() > 0) {
      console.log('  点击保存...');
      await saveBtn.click({ force: true });
      await page.waitForTimeout(4000);
      await waitForStableDOM(page);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n保存后:');
    console.log(text.substring(0, 1500));

    // ====== 2. Open smart assistant editor ======
    console.log('\n\n====== 2. 打开智能助手编辑器 ======');
    await page.goto(`${BASE}/app_trigger`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Find and click the card for "自动同步订单数据"
    const card = page.locator('.fx-automation-manage-card:has-text("自动同步订单数据")').first();
    console.log(`  智能助手卡片: ${await card.count()}个`);

    if (await card.count() > 0) {
      await card.click({ force: true });
      await page.waitForTimeout(5000);
      await waitForStableDOM(page);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('智能助手编辑器:');
    console.log(text.substring(0, 2500));
    console.log(`\nURL: ${page.url()}`);

    await page.screenshot({ path: 'screenshots/master15-smart-editor.png', fullPage: true });

    // Get editor HTML
    const smartEditorHTML = await page.evaluate(() => {
      const editor = document.querySelector('[class*="automation-edit"], [class*="trigger-edit"], [class*="workflow"]');
      return editor ? (editor as HTMLElement).innerHTML?.substring(0, 5000) : 'editor not found';
    });
    console.log('\n智能助手编辑器HTML (前4000字符):');
    console.log(smartEditorHTML?.substring(0, 4000));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
