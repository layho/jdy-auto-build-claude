/**
 * Phase 27 v2 - Flow Form: Add fields, configure flow, publish
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function main() {
  console.log('[PHASE 27 v2 - FLOW FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Navigate to the flow form editor
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1147c50b22fc86819c1038/edit#/edit', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== Step 1: Rename form ======
    console.log('[1] Renaming form...');
    const titleArea = page.locator('[class*="title"]').first();
    if (await titleArea.count() > 0) {
      await titleArea.click({ force: true });
      await page.waitForTimeout(500);
    }
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await nameInput.fill('请假申请');
      await page.keyboard.press('Enter');
      console.log('  Name: 请假申请');
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'screenshots/master27-1-named.png', fullPage: true });

    // ====== Step 2: Add fields (单行文本 for 请假人) ======
    console.log('\n[2] Adding fields...');

    // Click "单行文本" to add a single-line text field
    const singleLineText = page.locator(':text-is("单行文本")').first();
    if (await singleLineText.count() > 0) {
      await singleLineText.click({ force: true });
      console.log('  Added 单行文本');
      await page.waitForTimeout(1000);
    }

    // Add another field - 日期时间 for 开始日期
    const dateTime = page.locator(':text-is("日期时间")').first();
    if (await dateTime.count() > 0) {
      await dateTime.click({ force: true });
      console.log('  Added 日期时间');
      await page.waitForTimeout(1000);
    }

    // Add 多行文本 for 请假原因
    const multiLine = page.locator(':text-is("多行文本")').first();
    if (await multiLine.count() > 0) {
      await multiLine.click({ force: true });
      console.log('  Added 多行文本');
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'screenshots/master27-2-fields.png', fullPage: true });

    // ====== Step 3: Navigate to 流程设定 ======
    console.log('\n[3] Configuring flow...');
    const flowTab = page.locator(':text-is("流程设定")').first();
    if (await flowTab.count() > 0) {
      await flowTab.click({ force: true });
      console.log('  Clicked 流程设定');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    // Handle "是否保存" dialog if it appears
    const saveAndContinue = page.locator('button:has-text("保存并继续")').first();
    if (await saveAndContinue.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveAndContinue.click({ force: true });
      console.log('  Handled save dialog');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    const bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nFlow settings page has "审批":', bodyText.includes('审批'));
    console.log('Has "负责人":', bodyText.includes('负责人'));

    await page.screenshot({ path: 'screenshots/master27-3-flow.png', fullPage: true });

    // ====== Step 4: Publish ======
    console.log('\n[4] Publishing...');
    const publishTab = page.locator(':text-is("表单发布")').first();
    if (await publishTab.count() > 0) {
      await publishTab.click({ force: true });
      console.log('  Clicked 表单发布');
      await page.waitForTimeout(1500);
      await waitForStableDOM(page);
    }

    // Handle save dialog again if needed
    const saveContinue2 = page.locator('button:has-text("保存并继续")').first();
    if (await saveContinue2.isVisible({ timeout: 500 }).catch(() => false)) {
      await saveContinue2.click({ force: true });
      await page.waitForTimeout(1500);
      await waitForStableDOM(page);
    }

    // Click publish button
    const publishBtn = page.locator('button:has-text("发布")').first();
    if (await publishBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await publishBtn.click({ force: true });
      console.log('  Clicked 发布');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    } else {
      console.log('  Publish button not found - may already be published or need flow config');
    }

    await page.screenshot({ path: 'screenshots/master27-4-published.png', fullPage: true });
    console.log('\n✓ Phase 27 complete');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
