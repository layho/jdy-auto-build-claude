/**
 * ERP Stages 4-5: Aggregate tables + AI assistant
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

// Navigate to app admin sidebar item
async function clickSidebar(page: any, name: string) {
  await page.locator(`span.x-navigation-title-content:has-text("${name}")`).first().click({ force: true });
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
}

async function main() {
  console.log('[ERP STAGES 4-5]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Go to app admin
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(2000);
    await page.locator(':text("应用后台")').first().click({ force: true });
    await page.waitForTimeout(2000); await waitForStableDOM(page);

    // ====== 聚合表: 库存台账 ======
    console.log('[STAGE 4] Creating 库存台账 aggregate table...');
    await clickSidebar(page, '聚合表');

    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('Aggregate page:', bodyText.substring(0, 300));

    // Click 新建聚合表
    const newBtn = page.locator('button:has-text("新建聚合表")').first();
    if (await newBtn.count() > 0 && await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newBtn.click({ force: true });
      console.log('  Clicked 新建聚合表');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);

      // Select data source dialog should appear
      bodyText = await page.locator('body').first().innerText().catch(() => '');
      console.log('  Dialog:', bodyText.substring(0, 400));

      // Click 添加来源表 button
      const addSourceBtn = page.locator('.x-biz-entry-select-combo button.add-btn').first();
      if (await addSourceBtn.count() > 0 && await addSourceBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addSourceBtn.click({ force: true });
        console.log('  Clicked add source');
        await page.waitForTimeout(1000);

        // Select 采购入库单
        const receiptEntry = page.locator('[class*="popover"] .entry-item:has-text("采购入库单")').first();
        if (await receiptEntry.count() > 0 && await receiptEntry.isVisible({ timeout: 1000 }).catch(() => false)) {
          await receiptEntry.click({ force: true });
          console.log('  Selected 采购入库单');
          await page.waitForTimeout(500);
        }
      }

      // Click 确定
      const confirmBtn = page.locator('button:has-text("确定")').first();
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const disabled = await confirmBtn.isDisabled().catch(() => true);
        if (!disabled) {
          await confirmBtn.click({ force: true });
          console.log('  Confirmed');
          await page.waitForTimeout(3000);
          await waitForStableDOM(page);
        }
      }
    }

    await page.screenshot({ path: 'screenshots/erp-agg-create.png', fullPage: true });

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nAfter aggregate creation:');
    console.log(bodyText.substring(0, 500));

    // ====== AI Assistant: 库存预警助手 ======
    console.log('\n[STAGE 5] Creating 库存预警助手...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_trigger', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(2000);

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('Smart assistant page:', bodyText.substring(0, 300));

    // Click 新建智能助手
    const newAutoBtn = page.locator('button:has-text("新建智能助手")').first();
    if (await newAutoBtn.count() > 0 && await newAutoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newAutoBtn.click({ force: true });
      console.log('  Clicked 新建智能助手');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('Create dialog:', bodyText.substring(0, 500));

    await page.screenshot({ path: 'screenshots/erp-ai-create.png', fullPage: true });

    console.log('\n[ERP BUILD] Stages 4-5 exploration complete');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
