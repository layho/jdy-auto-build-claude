/**
 * Phase 25 v4 - Dashboard: Drag fields to dimension/metric, configure and save
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function main() {
  console.log('[PHASE 25 v4 - FULL DASHBOARD]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Step 1: Navigate to existing dashboard or create new ======
    console.log('[1] Setting up dashboard...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Create new dashboard
    await page.evaluate(() => {
      const btn = document.querySelector('button.add-button') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(1000);
    await page.locator('.x-menu-item:has-text("新建仪表盘")').first().click({ force: true });
    console.log('  Created');
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);
    const dashIdMatch = page.url().match(/dash\/([a-f0-9]+)\/edit/);
    const dashId = dashIdMatch ? dashIdMatch[1] : 'unknown';
    console.log(`  ID: ${dashId}`);

    // Rename
    const titleArea = page.locator('[class*="title"]').first();
    if (await titleArea.count() > 0) {
      await titleArea.click({ force: true });
      await page.waitForTimeout(500);
    }
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await nameInput.fill('订单数据概览');
      await page.keyboard.press('Enter');
      console.log('  Name: 订单数据概览');
      await page.waitForTimeout(1000);
    }

    // ====== Step 2: Add 统计表 ======
    console.log('\n[2] Adding 统计表...');
    await page.locator(':text-is("统计表")').first().click({ force: true });
    await page.waitForTimeout(1500);
    await page.locator('[class*="dialog"] :text-is("订单管理"), [class*="modal"] :text-is("订单管理")').first().click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('button:has-text("确定")').first().click({ force: true });
    console.log('  Data source: 订单管理');
    await page.waitForTimeout(4000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/master25-2-chart-added.png', fullPage: true });

    // ====== Step 3: Add dimension - drag "下单日期" to 维度 zone ======
    console.log('\n[3] Adding dimension: 下单日期');

    // Find the field in left panel
    const dateField = page.locator('.dash-source-field:has-text("下单日期")').first();
    // Find the dimension drop zone
    const dimZone = page.locator('.fx-dash-editor-main-axis-line:has-text("维度")').first();

    console.log(`  Field found: ${await dateField.count() > 0}`);
    console.log(`  Dim zone found: ${await dimZone.count() > 0}`);

    if (await dateField.count() > 0 && await dimZone.count() > 0) {
      // Drag the field to the dimension zone
      await dateField.dragTo(dimZone);
      console.log('  Dragged 下单日期 to 维度');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/master25-3-dimension.png', fullPage: true });

    // Check if dimension was added
    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  Has "下单日期" in config:', bodyText.includes('下单日期'));

    // ====== Step 4: Add metric - count of records ======
    console.log('\n[4] Adding metric...');
    // For metric, usually use COUNT or a numeric field
    // Try dragging "订单编号" to 指标 zone for a count
    const metricZone = page.locator('.fx-dash-editor-main-axis-line:has-text("指标")').first();
    const orderIdField = page.locator('.dash-source-field:has-text("订单编号")').first();

    if (await orderIdField.count() > 0 && await metricZone.count() > 0) {
      await orderIdField.dragTo(metricZone);
      console.log('  Dragged 订单编号 to 指标');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/master25-4-metric.png', fullPage: true });
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  Has "组件配置异常":', bodyText.includes('组件配置异常'));

    // ====== Step 5: Rename chart and save chart config ======
    console.log('\n[5] Saving chart config...');
    // Look for "保存" button in the chart editor (editor-head area)
    const chartSaveBtn = page.locator('.editor-head button:has-text("保存")').first();
    if (await chartSaveBtn.count() > 0 && await chartSaveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await chartSaveBtn.click({ force: true });
      console.log('  Clicked chart save');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    } else {
      console.log('  Chart save button not found');
    }

    await page.screenshot({ path: 'screenshots/master25-5-chart-saved.png', fullPage: true });

    // ====== Step 6: Add 明细表 ======
    console.log('\n[6] Adding 明细表...');
    await page.locator(':text-is("明细表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // Select data source for 明细表
    const detailSource = page.locator('[class*="dialog"] :text-is("订单管理"), [class*="modal"] :text-is("订单管理")').first();
    if (await detailSource.isVisible({ timeout: 2000 }).catch(() => false)) {
      await detailSource.click({ force: true });
      console.log('  Data source: 订单管理');
      await page.waitForTimeout(500);
    }
    const detailConfirm = page.locator('button:has-text("确定")').first();
    if (await detailConfirm.isVisible({ timeout: 1000 }).catch(() => false)) {
      await detailConfirm.click({ force: true });
      console.log('  Confirmed');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master25-6-detail.png', fullPage: true });

    // ====== Step 7: Save dashboard ======
    console.log('\n[7] Saving dashboard...');
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
          return;
        }
      }
    });
    console.log('  Clicked save');
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/master25-7-final.png', fullPage: true });

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nFinal check:');
    console.log('  Has 异常:', bodyText.includes('异常'));
    console.log('  Has 统计表:', bodyText.includes('统计表'));
    console.log('  Has 明细表:', bodyText.includes('明细表'));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
