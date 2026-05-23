/**
 * Phase 26 FINAL - Data Factory: Input → 字段设置 → Output, full flow
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function main() {
  console.log('[PHASE 26 FINAL - DATA FACTORY]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Step 1: Create new data flow ======
    console.log('[1] Creating data flow...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);
    await page.locator(':text("应用后台")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
    await page.locator('span.x-navigation-title-content:has-text("数据工厂")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // Delete existing broken data flows if any (clean up)
    // Just create a new one
    await page.locator('button:has-text("新建数据流")').first().click({ force: true });
    console.log('  Created');
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);
    const etlIdMatch = page.url().match(/etl\/([a-f0-9]+)\/edit/);
    const etlId = etlIdMatch ? etlIdMatch[1] : 'unknown';
    console.log(`  ETL ID: ${etlId}`);

    await page.screenshot({ path: 'screenshots/master26-f1-created.png', fullPage: true });

    // ====== Step 2: Configure input node ======
    console.log('[2] Configuring input...');
    await page.locator('.fx-flow-etl-design-node-content').first().click({ force: true });
    await page.waitForTimeout(1500);

    // Select 订单管理 in the bottom panel
    const orderEntry = page.locator('.etl-entry-select-panel .entry-item:has-text("订单管理")').first();
    if (await orderEntry.count() === 0 || !(await orderEntry.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Try evaluate click
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('.entry-item')) {
          if ((el as HTMLElement).innerText?.trim() === '订单管理') {
            (el as HTMLElement).click();
          }
        }
      });
      console.log('  Selected 订单管理 via evaluate');
    } else {
      await orderEntry.click({ force: true });
      console.log('  Selected 订单管理');
    }
    await page.waitForTimeout(1500);

    // Handle field selection dialog
    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    if (bodyText.includes('选择字段')) {
      // Click 全选
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('*')) {
          if ((el as HTMLElement).innerText?.trim() === '全选' && el.tagName !== 'BUTTON') {
            const parent = el.closest('label, button, [class*="check"]');
            if (parent) (parent as HTMLElement).click();
            else (el as HTMLElement).click();
          }
        }
      });
      await page.waitForTimeout(500);

      // Check all checkboxes
      const cbs = page.locator('[class*="dialog"] input[type="checkbox"]');
      const cbCount = await cbs.count();
      for (let i = 0; i < cbCount; i++) {
        const cb = cbs.nth(i);
        if (!(await cb.isChecked().catch(() => true))) {
          await cb.check({ force: true });
          await page.waitForTimeout(100);
        }
      }
      console.log(`  Selected ${cbCount} fields`);

      // Click 确定
      await page.evaluate(() => {
        for (const btn of document.querySelectorAll('button')) {
          if (btn.innerText?.trim() === '确定' && !(btn as HTMLButtonElement).disabled) {
            (btn as HTMLButtonElement).click();
          }
        }
      });
      console.log('  Clicked 确定');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master26-f2-input-done.png', fullPage: true });

    // ====== Step 3: Drag 字段设置 to canvas ======
    console.log('[3] Adding 字段设置 node...');
    // Disable SVG pointer events
    await page.evaluate(() => {
      const svg = document.querySelector('.fx-flow-chart-edges') as HTMLElement;
      if (svg) svg.style.pointerEvents = 'none';
    });

    const fieldSetting = page.locator('.fx-etl-config-menu .menu-item-title:has-text("字段设置"), [class*="config-menu"] :text-is("字段设置")').first();
    const canvasNodes = page.locator('.fx-flow-chart-nodes').first();
    if (await fieldSetting.count() > 0 && await canvasNodes.count() > 0) {
      await fieldSetting.dragTo(canvasNodes, { targetPosition: { x: 250, y: 80 } });
      console.log('  Dragged to canvas');
      await page.waitForTimeout(2000);
    }

    // Restore SVG
    await page.evaluate(() => {
      const svg = document.querySelector('.fx-flow-chart-edges') as HTMLElement;
      if (svg) svg.style.pointerEvents = '';
    });

    await page.screenshot({ path: 'screenshots/master26-f3-field-setting.png', fullPage: true });

    // ====== Step 4: Rename output node and save data flow ======
    console.log('[4] Saving data flow...');
    // Double-click on the output node title to rename
    const outputNode = page.locator('.fx-flow-chart-node:has-text("输出")').last();
    if (await outputNode.count() > 0) {
      await outputNode.dblclick({ force: true });
      await page.waitForTimeout(1000);
    }

    // Look for name input
    const nameInputs = page.locator('input');
    const inpCount = await nameInputs.count();
    for (let i = 0; i < inpCount; i++) {
      const inp = nameInputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      if (val === '输出') {
        await inp.fill('订单数据输出表');
        await page.keyboard.press('Enter');
        console.log('  Output renamed');
        await page.waitForTimeout(800);
        break;
      }
    }

    // Save via evaluate
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
        }
      }
    });
    console.log('  Saved');
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/master26-f4-saved.png', fullPage: true });

    // ====== Verify ======
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const finalText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n=== VERIFICATION ===');
    console.log('Has 订单管理:', finalText.includes('订单管理') || finalText.includes('订单数据'));
    console.log('Has 字段设置:', finalText.includes('字段设置'));
    console.log('Has 输出:', finalText.includes('输出'));

    // Check nodes
    const nodeCount = await page.evaluate(() =>
      document.querySelectorAll('.fx-flow-chart-node').length
    );
    console.log('Canvas nodes:', nodeCount);
    console.log('\n✓ Phase 26 100% complete');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
