/**
 * Phase 16 - 完整创建+配置+保存数据推送
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
  console.log('[PHASE 16 - COMPLETE DATA PUSH]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Create data push from scratch ======
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建数据推送")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Select form
    await page.locator('.fx-app-data-push-create-dialog .x-biz-dropdown-label').first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.locator('[class*="popover"] .entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(1000);

    // Click 确定 to proceed to config
    await page.locator('.fx-app-data-push-create-dialog .dialog-footer button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('配置页:');
    console.log(text.substring(0, 2000));

    // Check if we're on a config page (dialog expanded or new page)
    const hasServerField = text.includes('目标服务器') || text.includes('服务器地址');
    console.log(`\n有服务器配置: ${hasServerField}`);

    if (hasServerField) {
      // Fill server URL - find text input (not checkbox)
      const allInputs = page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
      const inputCount = await allInputs.count();
      console.log(`\n文本输入框: ${inputCount}个`);

      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const inp = allInputs.nth(i);
        const type = await inp.getAttribute('type').catch(() => 'text');
        const placeholder = await inp.getAttribute('placeholder').catch(() => '');
        const value = await inp.inputValue().catch(() => '');
        console.log(`  [${i}] type=${type} placeholder="${placeholder}" value="${value}"`);
      }

      // Fill the server URL input (first visible text input)
      const serverUrlInput = page.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])').first();
      if (await serverUrlInput.count() > 0) {
        await serverUrlInput.click({ force: true });
        await page.waitForTimeout(300);
        await serverUrlInput.fill('https://httpbin.org/post');
        await page.waitForTimeout(500);
        console.log('✓ 填入服务器地址');

        // Generate Secret
        const genSecretBtn = page.locator('button:has-text("生成"), span:has-text("生成 Secret")').first();
        if (await genSecretBtn.count() > 0) {
          await genSecretBtn.click({ force: true });
          await page.waitForTimeout(1000);
          console.log('✓ 生成 Secret');
        }

        // Click 保存
        const saveBtn = page.locator('button:has-text("保存")').first();
        console.log(`\n保存按钮: ${await saveBtn.count()}个`);
        if (await saveBtn.count() > 0) {
          await saveBtn.click({ force: true });
          await page.waitForTimeout(4000);
          await waitForStableDOM(page);
          console.log('✓ 已保存数据推送');
        }
      }
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n保存后页面:');
    console.log(text.substring(0, 1500));

    await page.screenshot({ path: 'screenshots/master16-push-saved.png', fullPage: true });

    // ====== 2. Check the data push list ======
    console.log('\n====== 数据推送列表 ======');
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log(text.substring(0, 1500));

    // ====== 3. Now open the smart assistant editor ======
    console.log('\n\n====== 智能助手编辑器 ======');
    await page.goto(`${BASE}/app_trigger`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click the automation card
    const card = page.locator('.fx-automation-manage-card:has-text("自动同步订单数据")').first();
    console.log(`智能助手卡片: ${await card.count()}个`);

    if (await card.count() > 0) {
      await card.click({ force: true });
      await page.waitForTimeout(5000);
      await waitForStableDOM(page);
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('编辑器:');
    console.log(text.substring(0, 2500));
    console.log(`\nURL: ${page.url()}`);

    await page.screenshot({ path: 'screenshots/master16-smart-editor.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
