/**
 * Complete ERP: Aggregate table config + AI assistant + cleanup old automation
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function main() {
  console.log('[ERP COMPLETE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Clean up old smart assistant ======
    console.log('[CLEANUP] Removing old automation...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_trigger', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(2000);

    // Find and delete the old "自动同步订单数据" automation
    const oldCard = page.locator('[class*="card"]:has-text("自动同步订单数据")').first();
    if (await oldCard.count() > 0) {
      await oldCard.hover();
      await page.waitForTimeout(500);
      // Look for more actions / delete button
      const moreBtn = oldCard.locator('[class*="more"], [class*="action"]').first();
      if (await moreBtn.count() > 0) {
        await moreBtn.click({ force: true });
        await page.waitForTimeout(500);
        const deleteOpt = page.locator('[class*="dropdown"] :text-is("删除"), [class*="popover"] :text-is("删除")').first();
        if (await deleteOpt.isVisible({ timeout: 500 }).catch(() => false)) {
          await deleteOpt.click({ force: true });
          console.log('  Deleted old automation');
          await page.waitForTimeout(1000);
        }
      }
    } else {
      console.log('  Old automation not found');
    }

    // ====== Complete aggregate table ======
    console.log('\n[AGGREGATE] Configuring 库存台账...');

    // Navigate to aggregate table list and find our table
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_aggregate', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(2000);

    // Click on the "未命名聚合表" card to edit it
    const aggCard = page.locator('.fx-aggregate-view-card:has-text("未命名聚合表")').first();
    if (await aggCard.count() > 0) {
      await aggCard.click({ force: true });
      console.log('  Opened aggregate table');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  Page:', bodyText.substring(0, 400));

    // Click "添加维度"
    const addDim = page.locator(':text-is("添加维度"), button:has-text("添加维度")').first();
    if (await addDim.count() > 0 && await addDim.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addDim.click({ force: true });
      console.log('  Clicked 添加维度');
      await page.waitForTimeout(1000);

      // Select a field (商品) from the dropdown
      const fieldOpt = page.locator('[class*="field-adder"] .entry-item:has-text("商品"), [class*="dropdown"] :text-is("商品")').first();
      if (await fieldOpt.count() > 0 && await fieldOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fieldOpt.click({ force: true });
        console.log('  Selected 商品 as dimension');
        await page.waitForTimeout(500);
      }
    }

    // Click "添加指标"
    const addMetric = page.locator(':text-is("添加指标"), button:has-text("添加指标")').first();
    if (await addMetric.count() > 0 && await addMetric.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addMetric.click({ force: true });
      console.log('  Clicked 添加指标');
      await page.waitForTimeout(1500);

      // The formula editor dialog should open
      bodyText = await page.locator('body').first().innerText().catch(() => '');
      console.log('  Formula dialog:', bodyText.substring(0, 300));

      // Click 确定 in formula dialog
      const confirmF = page.locator('.dialog-footer button:has-text("确定"), button:has-text("确定")').first();
      if (await confirmF.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmF.click({ force: true });
        console.log('  Confirmed metric');
        await page.waitForTimeout(1000);
      }
    }

    // Rename aggregate table
    const aggTitle = page.locator('[class*="title"]').first();
    if (await aggTitle.count() > 0) {
      await aggTitle.click({ force: true });
      await page.waitForTimeout(500);
    }
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await nameInput.fill('库存台账');
      await page.keyboard.press('Enter');
      console.log('  Named: 库存台账');
      await page.waitForTimeout(1000);
    }

    // Save aggregate table
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
        }
      }
    });
    console.log('  Saved');
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/erp-agg-complete.png', fullPage: true });

    // ====== Create AI assistant ======
    console.log('\n[AI] Creating 库存预警助手...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_trigger', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(2000);

    await page.locator('button:has-text("新建智能助手")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // Fill name
    const aiNameInput = page.locator('[class*="dialog"] input, [class*="modal"] input').first();
    if (await aiNameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await aiNameInput.fill('库存预警助手');
      console.log('  Named: 库存预警助手');
      await page.waitForTimeout(500);
    }

    // Select 定时触发
    const timedTrigger = page.locator(':text-is("定时触发")').first();
    if (await timedTrigger.count() > 0) {
      await timedTrigger.click({ force: true });
      console.log('  Selected 定时触发');
      await page.waitForTimeout(500);
    }

    // Click 确定
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.innerText?.trim() === '确定' && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
        }
      }
    });
    console.log('  Confirmed');
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/erp-ai-done.png', fullPage: true });

    console.log('\n[ERP BUILD] All stages executed');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
