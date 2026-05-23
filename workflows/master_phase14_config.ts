/**
 * Phase 14 - 深入配置智能助手和数据推送
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
  console.log('[PHASE 14 - CONFIGURE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Click into the smart assistant to see full config ======
    console.log('====== 1. 智能助手完整配置 ======');
    await page.goto(`${BASE}/app_trigger`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click on "自动同步订单数据" to open config
    const smartEntry = page.locator(':has-text("自动同步订单数据")').first();
    if (await smartEntry.count() > 0) {
      await smartEntry.click({ force: true });
      await page.waitForTimeout(4000);
      await waitForStableDOM(page);
    }

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('智能助手配置页:');
    console.log(text.substring(0, 2500));
    console.log(`\nURL: ${page.url()}`);

    await page.screenshot({ path: 'screenshots/master14-smart-config.png', fullPage: true });

    // Get the full editor HTML
    const editorHTML = await page.evaluate(() => {
      const main = document.querySelector('[class*="automation"], [class*="trigger"], [class*="workflow"]');
      return main ? (main as HTMLElement).innerHTML?.substring(0, 5000) : 'main not found';
    });
    console.log('\n编辑器HTML (前4000字符):');
    console.log(editorHTML?.substring(0, 4000));

    // ====== 2. Check if data push got created ======
    console.log('\n\n====== 2. 数据推送列表 ======');
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log(text.substring(0, 1500));

    // Try creating data push again and check what page it goes to
    console.log('\n重新尝试创建数据推送...');
    await page.locator('button:has-text("新建数据推送")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.locator('.fx-app-data-push-create-dialog .x-biz-dropdown-label').first().click({ force: true });
    await page.waitForTimeout(2000);
    await page.locator('[class*="popover"] .entry-item:has-text("产品信息")').first().click({ force: true });
    await page.waitForTimeout(1000);

    // Click 确定
    const pushOk = page.locator('.fx-app-data-push-create-dialog .dialog-footer button:has-text("确定")').first();
    await pushOk.click({ force: true });
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('确定后:');
    console.log(text.substring(0, 1500));
    console.log(`URL: ${page.url()}`);

    await page.screenshot({ path: 'screenshots/master14-push-after-create.png', fullPage: true });

    // ====== 3. Explore dashboard creation ======
    console.log('\n\n====== 3. 仪表盘 ======');
    // Try different dashboard URLs
    const dashURLs = [
      'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06/dashboard',
      'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06',
    ];
    for (const url of dashURLs) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(3000);
      text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`URL: ${url}`);
      console.log(text.substring(0, 800));
      console.log('---');
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
