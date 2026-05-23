/**
 * Stage 0: Clean the 爱马仕 app - delete all forms, dashboards, aggregate tables, etc.
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function main() {
  console.log('[STAGE 0] CLEANING APP\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Step 1: Navigate to app admin ======
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click 应用后台
    await page.locator(':text("应用后台")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('[WORKFLOW] App admin loaded');
    console.log(bodyText.substring(0, 500));

    // ====== Step 2: Delete aggregate tables ======
    console.log('\n[WORKFLOW] Deleting aggregate tables...');
    await page.locator('span.x-navigation-title-content:has-text("聚合表")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // Check for aggregate tables
    let aggCards = page.locator('.fx-aggregate-view-card');
    let aggCount = await aggCards.count();
    console.log(`  Aggregate tables found: ${aggCount}`);

    for (let i = 0; i < aggCount; i++) {
      const card = aggCards.first();
      await card.hover();
      await page.waitForTimeout(500);

      const deleteBtn = card.locator('button.aggregate-delete-btn, [class*="delete"]').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await deleteBtn.click({ force: true });
        console.log('  [DELETE] Clicked delete on aggregate table');
        await page.waitForTimeout(800);

        // Confirm deletion
        const confirmDel = page.locator('button:has-text("删除"), button:has-text("确定")').first();
        if (await confirmDel.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmDel.click({ force: true });
          console.log('  [CONFIRM] Deletion confirmed');
          await page.waitForTimeout(2000);
          await waitForStableDOM(page);
        }
      }
      aggCards = page.locator('.fx-aggregate-view-card');
      aggCount = await aggCards.count();
    }

    await page.screenshot({ path: 'screenshots/stage0-agg-deleted.png', fullPage: true });

    // ====== Step 3: Delete smart assistants ======
    console.log('\n[WORKFLOW] Deleting smart assistants...');
    await page.locator('span.x-navigation-title-content:has-text("智能助手")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  Smart assistant page:', bodyText.substring(0, 400));

    // Look for delete/more actions on automation cards
    const autoCards = page.locator('[class*="card"]:has-text("自动同步"), [class*="item"]:has-text("自动同步")');
    const autoCount = await autoCards.count();
    console.log(`  Automation items: ${autoCount}`);

    for (let i = 0; i < autoCount; i++) {
      const card = autoCards.first();
      await card.hover();
      await page.waitForTimeout(500);

      // Try more actions button or delete
      const moreBtn = card.locator('[class*="more"], [class*="action-btn"]').first();
      if (await moreBtn.count() > 0 && await moreBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await moreBtn.click({ force: true });
        await page.waitForTimeout(500);
        const deleteOpt = page.locator('[class*="dropdown"] :text-is("删除"), [class*="menu"] :text-is("删除"), [class*="popover"] :text-is("删除")').first();
        if (await deleteOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
          await deleteOpt.click({ force: true });
          console.log('  [DELETE] Clicked delete on automation');
          await page.waitForTimeout(1000);
        }
      }
    }

    await page.screenshot({ path: 'screenshots/stage0-auto-deleted.png', fullPage: true });

    // ====== Step 4: Delete data flows ======
    console.log('\n[WORKFLOW] Deleting data flows...');
    await page.locator('span.x-navigation-title-content:has-text("数据工厂")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  Data factory:', bodyText.substring(0, 400));

    await page.screenshot({ path: 'screenshots/stage0-etl-deleted.png', fullPage: true });

    // ====== Step 5: Go back to app view and delete forms/dashboards ======
    console.log('\n[WORKFLOW] Deleting forms and dashboards...');
    // Go back to app view
    const backBtn = page.locator('.back-icon-wrapper, [class*="back-icon"]').first();
    if (await backBtn.count() > 0) {
      await backBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    } else {
      await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(3000);
    }

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('  App view:', bodyText.substring(0, 500));

    // Need to delete forms - go to form editor then settings
    // Forms: 客户信息, 产品信息, 订单管理, 订单明细表, 请假申请
    // Click each form in the menu and navigate to form settings for deletion

    const formsToDelete = ['请假申请', '订单明细表', '订单管理', '产品信息', '客户信息'];

    for (const formName of formsToDelete) {
      console.log(`\n  Deleting form: ${formName}`);
      // Click on form in the menu tree
      const formLink = page.locator(`span.node-content-wrapper:has-text("${formName}")`).first();
      if (await formLink.count() > 0) {
        await formLink.click({ force: true });
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
      }

      // Click 编辑 to enter form editor
      const editBtn = page.locator('button:has-text("编辑")').first();
      if (await editBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await editBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);
      }

      // Look for form settings / delete option
      // Click on the form name/title to open the settings menu
      const formTitle = page.locator('[class*="title"], [class*="name"]').first();
      if (await formTitle.count() > 0) {
        await formTitle.click({ force: true });
        await page.waitForTimeout(1000);
      }

      // Look for "其他设置" or "删除" in the form actions
      bodyText = await page.locator('body').first().innerText().catch(() => '');
      if (bodyText.includes('其他设置')) {
        const settingsBtn = page.locator(':text-is("其他设置"), [class*="more"]:has-text("设置")').first();
        if (await settingsBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await settingsBtn.click({ force: true });
          await page.waitForTimeout(1000);
        }
      }

      if (bodyText.includes('删除')) {
        const deleteFormBtn = page.locator('button:has-text("删除"), :text-is("删除")').first();
        if (await deleteFormBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await deleteFormBtn.click({ force: true });
          console.log(`  [DELETE] Clicked delete on ${formName}`);
          await page.waitForTimeout(1000);

          // Confirm
          const confirmBtn = page.locator('button:has-text("确定"), button:has-text("删除")').first();
          if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await confirmBtn.click({ force: true });
            console.log('  [CONFIRM] Deletion confirmed');
            await page.waitForTimeout(2000);
            await waitForStableDOM(page);
          }
        }
      }

      // Go back to app view
      await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(2000);
    }

    // Delete dashboards
    console.log('\n[WORKFLOW] Deleting dashboards...');
    const dashItems = page.locator('span.node-content-wrapper:has-text("仪表盘"), span.node-content-wrapper:has-text("概览"), span.node-content-wrapper:has-text("未命名")');
    const dashCount = await dashItems.count();
    console.log(`  Dashboard items: ${dashCount}`);

    for (let i = 0; i < dashCount; i++) {
      const item = dashItems.nth(i);
      if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
        await item.click({ force: true });
        await page.waitForTimeout(1500);
      }
      // Try to find delete option
      const moreActions = page.locator('[class*="more"], [class*="action"] button').first();
      if (await moreActions.isVisible({ timeout: 500 }).catch(() => false)) {
        await moreActions.click({ force: true });
        await page.waitForTimeout(500);
        const deleteOpt = page.locator(':text-is("删除")').first();
        if (await deleteOpt.isVisible({ timeout: 500 }).catch(() => false)) {
          await deleteOpt.click({ force: true });
          console.log('  [DELETE] Deleted a dashboard');
          await page.waitForTimeout(1500);
        }
      }
    }

    // Final check
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n[VALIDATION] Final app state:');
    console.log(bodyText.substring(0, 500));

    await page.screenshot({ path: 'screenshots/stage0-cleaned.png', fullPage: true });
    console.log('\n[WORKFLOW] Stage 0 complete');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
