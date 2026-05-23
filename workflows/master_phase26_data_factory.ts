/**
 * Phase 26 v2 - Full Data Factory: Configure input → field settings → output
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function main() {
  console.log('[PHASE 26 v2 - DATA FACTORY]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Navigate to data factory
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);
    await page.locator(':text("应用后台")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
    await page.locator('span.x-navigation-title-content:has-text("数据工厂")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // Create new data flow
    const newBtn = page.locator('button:has-text("新建数据流")').first();
    if (await newBtn.count() > 0) {
      await newBtn.click({ force: true });
      console.log('[1] Created new data flow');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    const etlIdMatch = page.url().match(/etl\/([a-f0-9]+)\/edit/);
    const etlId = etlIdMatch ? etlIdMatch[1] : 'unknown';
    console.log(`  ETL ID: ${etlId}`);

    // ====== Step 1: Configure input node ======
    console.log('\n[2] Configuring input node...');
    // Click on the input node content to open config panel
    await page.locator('.fx-flow-etl-design-node-content').first().click({ force: true });
    await page.waitForTimeout(1500);

    // Select "订单管理" as data source from the panel
    const sourceItem = page.locator('.etl-entry-select-panel :text-is("订单管理"), .panel-content :text-is("订单管理")').first();
    if (await sourceItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sourceItem.click({ force: true });
      console.log('  Selected data source: 订单管理');
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'screenshots/master26-2-source-selected.png', fullPage: true });

    // Select all available fields - look for the dialog
    const dialogText = await page.locator('[class*="dialog"]').first().innerText().catch(() => '');
    console.log('  Dialog text:', dialogText?.substring(0, 300));

    // In the field selection dialog, try to select all checkboxes
    const checkboxes = page.locator('[class*="dialog"] input[type="checkbox"], [class*="field-select"] input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    console.log(`  Checkboxes: ${cbCount}`);

    for (let i = 0; i < cbCount; i++) {
      const cb = checkboxes.nth(i);
      if (!(await cb.isChecked().catch(() => true))) {
        await cb.check({ force: true });
        await page.waitForTimeout(100);
      }
    }

    // Click "确定" in the dialog
    const confirmDialog = page.locator('[class*="dialog"] button:has-text("确定")').first();
    if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmDialog.click({ force: true });
      console.log('  Clicked 确定 in dialog');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master26-3-input-done.png', fullPage: true });

    // ====== Step 2: Add 字段设置 node ======
    console.log('\n[3] Adding 字段设置 node...');

    // Disable pointer-events on SVG edges overlay that blocks drops
    await page.evaluate(() => {
      const svg = document.querySelector('.fx-flow-chart-edges') as HTMLElement;
      if (svg) svg.style.pointerEvents = 'none';
    });
    console.log('  Disabled SVG pointer events');

    // Drag "字段设置" from left menu to canvas
    const fieldSettingNode = page.locator('.fx-etl-config-menu :text-is("字段设置")').first();
    const canvasArea = page.locator('.fx-flow-chart-nodes').first();

    if (await fieldSettingNode.count() > 0 && await canvasArea.count() > 0) {
      await fieldSettingNode.dragTo(canvasArea, { targetPosition: { x: 250, y: 100 } });
      console.log('  Dragged 字段设置 to canvas');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    // Restore pointer events
    await page.evaluate(() => {
      const svg = document.querySelector('.fx-flow-chart-edges') as HTMLElement;
      if (svg) svg.style.pointerEvents = '';
    });

    await page.screenshot({ path: 'screenshots/master26-4-field-setting.png', fullPage: true });

    // ====== Step 3: Save the data flow ======
    console.log('\n[4] Saving...');
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

    await page.screenshot({ path: 'screenshots/master26-5-saved.png', fullPage: true });

    const finalText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nFinal:');
    console.log('  Has 输入:', finalText.includes('输入'));
    console.log('  Has 输出:', finalText.includes('输出'));
    console.log('  Has 订单管理:', finalText.includes('订单管理'));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
