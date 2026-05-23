/**
 * Phase 28 - Frontend Events: Configure on 订单管理 form
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function main() {
  console.log('[PHASE 28 - FRONTEND EVENTS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Navigate to 订单管理 form editor
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== Step 1: Open 订单管理 form in editor ======
    console.log('[1] Opening 订单管理 form...');
    // Click on 订单管理 in the menu tree
    await page.locator('span.node-content-wrapper:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(1500);
    await waitForStableDOM(page);

    // Click "编辑" button to enter form editor
    const editBtn = page.locator('button:has-text("编辑")').first();
    if (await editBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await editBtn.click({ force: true });
      console.log('  Clicked 编辑');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    console.log('  URL:', page.url());
    await page.screenshot({ path: 'screenshots/master28-1-editor.png', fullPage: true });

    // ====== Step 2: Navigate to 扩展功能 tab ======
    console.log('\n[2] Navigating to 扩展功能...');
    const extTab = page.locator(':text-is("扩展功能")').first();
    if (await extTab.count() > 0 && await extTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await extTab.click({ force: true });
      console.log('  Clicked 扩展功能');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    } else {
      console.log('  扩展功能 tab not found');
    }

    const bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nExtension page:');
    console.log(bodyText.substring(0, 800));

    // Look for 前端事件
    console.log('Has 前端事件:', bodyText.includes('前端事件'));
    console.log('Has 智能助手:', bodyText.includes('智能助手'));
    console.log('Has 数据联动:', bodyText.includes('数据联动'));

    await page.screenshot({ path: 'screenshots/master28-2-extensions.png', fullPage: true });

    // ====== Step 3: Configure frontend event if available ======
    if (bodyText.includes('前端事件')) {
      console.log('\n[3] Configuring frontend event...');
      // Look for "新建前端事件" or "添加" button
      const addEventBtn = page.locator('button:has-text("新建前端事件"), button:has-text("添加事件"), button:has-text("前端事件")').first();
      if (await addEventBtn.count() > 0 && await addEventBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addEventBtn.click({ force: true });
        console.log('  Clicked add frontend event');
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
      }

      const eventText = await page.locator('body').first().innerText().catch(() => '');
      console.log('\nEvent config:');
      console.log(eventText.substring(0, 800));

      await page.screenshot({ path: 'screenshots/master28-3-event-config.png', fullPage: true });
    }

    console.log('\n✓ Phase 28 complete');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
