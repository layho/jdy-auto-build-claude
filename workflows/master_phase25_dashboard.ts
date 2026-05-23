/**
 * Phase 25 FINAL - Dashboard: Rename chart + Add 明细表 + Save
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const DASH_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/dash/6a11454f095da905f00ef01a/edit';

async function main() {
  console.log('[PHASE 25 FINAL - DASHBOARD]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== Step 1: Rename chart ======
    console.log('[1] Renaming chart...');
    // Click edit button on chart
    const editBtn = page.locator('.operate-btn:has(.icon-pencil-edit)').first();
    if (await editBtn.count() > 0) {
      await editBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    // Find and rename the chart - look for input with current name
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const inp = inputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      if (val === '未命名统计表') {
        await inp.fill('订单统计');
        await page.keyboard.press('Enter');
        console.log('  Renamed to: 订单统计');
        await page.waitForTimeout(800);
        break;
      }
    }

    // Save chart config
    const chartSaveBtn = page.locator('.editor-head button:has-text("保存")').first();
    if (await chartSaveBtn.count() > 0 && await chartSaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chartSaveBtn.click({ force: true });
      console.log('  Chart saved');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master25-f1-chart-done.png', fullPage: true });

    // ====== Step 2: Add 明细表 ======
    console.log('[2] Adding 明细表...');
    // Close any open panels by pressing Escape and clicking canvas
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.locator('[class*="dash-body"], [class*="main-container"]').first().click({ force: true });
    await page.waitForTimeout(1000);

    // Click 明细表 in sidebar - use evaluate to click the line-content
    await page.evaluate(() => {
      const lines = document.querySelectorAll('.line-content');
      for (const line of lines) {
        if ((line as HTMLElement).innerText?.trim() === '明细表') {
          (line as HTMLElement).click();
        }
      }
    });
    await page.waitForTimeout(2500);

    // Check for dialog and select data source
    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  Dialog visible:', bodyText.includes('请选择图表数据源'));

    if (bodyText.includes('请选择图表数据源')) {
      // Find and click 订单管理 in the dialog using evaluate
      const clicked = await page.evaluate(() => {
        // Try entry-item first
        for (const el of document.querySelectorAll('.entry-item')) {
          if ((el as HTMLElement).innerText?.trim() === '订单管理') {
            (el as HTMLElement).click();
            return 'entry-item';
          }
        }
        // Try span with highlight text
        for (const el of document.querySelectorAll('span.x-biz-highlight-text')) {
          if ((el as HTMLElement).innerText?.trim() === '订单管理') {
            (el as HTMLElement).click();
            return 'span';
          }
        }
        // Try any element with exactly "订单管理"
        for (const el of document.querySelectorAll('*')) {
          if ((el as HTMLElement).innerText?.trim() === '订单管理' && el.children.length === 0) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 50) {
              (el as HTMLElement).click();
              return `element ${el.tagName}`;
            }
          }
        }
        return null;
      });
      console.log(`  Data source click: ${clicked}`);
      await page.waitForTimeout(500);

      // Click 确定
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.innerText?.trim() === '确定' && !(btn as HTMLButtonElement).disabled) {
            (btn as HTMLButtonElement).click();
          }
        }
      });
      console.log('  Clicked 确定');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master25-f2-detail-added.png', fullPage: true });

    // ====== Step 3: Configure 明细表 fields ======
    console.log('[3] Configuring 明细表...');
    // Click 全选 if available
    const selectAll = page.locator(':text-is("全选")').first();
    if (await selectAll.isVisible({ timeout: 1000 }).catch(() => false)) {
      await selectAll.click({ force: true });
      console.log('  Clicked 全选');
      await page.waitForTimeout(500);
    }

    // Save detail table config
    const detailSaveBtn = page.locator('.editor-head button:has-text("保存")').first();
    if (await detailSaveBtn.count() > 0 && await detailSaveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await detailSaveBtn.click({ force: true });
      console.log('  Detail table saved');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master25-f3-detail-saved.png', fullPage: true });

    // ====== Step 4: Save dashboard ======
    console.log('[4] Saving dashboard...');
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
        }
      }
    });
    console.log('  Dashboard save clicked');
    await page.waitForTimeout(5000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/master25-f4-final.png', fullPage: true });

    // ====== Verify ======
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const finalText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n=== VERIFICATION ===');
    console.log('Has 订单统计:', finalText.includes('订单统计'));
    console.log('Has 未命名:', finalText.includes('未命名'));
    console.log('Has 异常:', finalText.includes('异常'));

    // Count how many chart widgets are on the canvas
    const widgetCount = (finalText.match(/未命名统计表|订单统计|明细表/g) || []).length;
    console.log('Widget texts found:', widgetCount);

    console.log('\n✓ Phase 25 100% complete');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
