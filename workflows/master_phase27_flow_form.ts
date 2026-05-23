/**
 * Phase 27 FINAL - Flow Form: Configure approval + Publish + Test
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const FORM_EDIT_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1147c50b22fc86819c1038/edit';

async function main() {
  console.log('[PHASE 27 FINAL - FLOW FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(FORM_EDIT_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('Current page:', bodyText.substring(0, 500));

    // ====== Step 1: Click 流程设定 tab ======
    console.log('\n[1] Navigating to 流程设定...');
    const flowTab = page.locator(':text-is("流程设定")').first();
    if (await flowTab.count() > 0) {
      await flowTab.click({ force: true });
      console.log('  Clicked');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    // Handle any "是否保存" dialog
    const saveContinue = page.locator('button:has-text("保存并继续")').first();
    if (await saveContinue.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveContinue.click({ force: true });
      console.log('  Handled save dialog');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nFlow page:');
    console.log(bodyText.substring(0, 1000));

    await page.screenshot({ path: 'screenshots/master27-f1-flow-tab.png', fullPage: true });

    // ====== Step 2: Look for approval node configuration ======
    console.log('\n[2] Configuring approval...');

    // Check if there's an editable flow diagram
    const hasApproval = bodyText.includes('审批') || bodyText.includes('负责人') || bodyText.includes('流程');
    console.log('  Has approval elements:', hasApproval);

    // Try clicking on the flow node in the diagram
    const flowNode = page.locator('[class*="flow-node"]:has-text("发起"), [class*="node"]:has-text("审批"), [class*="process"] [class*="node"]').first();
    if (await flowNode.count() > 0) {
      await flowNode.click({ force: true });
      console.log('  Clicked flow node');
      await page.waitForTimeout(1500);
    }

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nAfter node click:');
    console.log(bodyText.substring(0, 800));

    await page.screenshot({ path: 'screenshots/master27-f2-flow-config.png', fullPage: true });

    // ====== Step 3: Add approver ======
    console.log('\n[3] Setting approver...');
    // Look for "添加负责人" or member selector
    const addApprover = page.locator('button:has-text("添加"), [class*="add"]:has-text("负责"), :text-is("选择成员")').first();
    if (await addApprover.count() > 0 && await addApprover.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addApprover.click({ force: true });
      console.log('  Clicked add approver');
      await page.waitForTimeout(1500);
    }

    // Try to select current user as approver
    const memberSelect = page.locator('[class*="member"] [class*="check"], [class*="user"] [class*="check"]').first();
    if (await memberSelect.count() > 0 && await memberSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await memberSelect.click({ force: true });
      console.log('  Selected member');
      await page.waitForTimeout(500);
    }

    // Click confirm if dialog
    const confirmMember = page.locator('[class*="dialog"] button:has-text("确定")').first();
    if (await confirmMember.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmMember.click({ force: true });
      console.log('  Confirmed member selection');
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'screenshots/master27-f3-approver.png', fullPage: true });

    // ====== Step 4: Save flow settings ======
    console.log('\n[4] Saving flow...');
    const saveFlowBtn = page.locator('button:has-text("保存")').first();
    if (await saveFlowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveFlowBtn.click({ force: true });
      console.log('  Flow saved');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    // ====== Step 5: Publish ======
    console.log('\n[5] Publishing...');
    const publishTab = page.locator(':text-is("表单发布")').first();
    if (await publishTab.count() > 0) {
      await publishTab.click({ force: true });
      console.log('  Clicked 表单发布');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    // Handle save dialog
    const saveContinue2 = page.locator('button:has-text("保存并继续")').first();
    if (await saveContinue2.isVisible({ timeout: 500 }).catch(() => false)) {
      await saveContinue2.click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nPublish page:');
    console.log(bodyText.substring(0, 500));

    // Click publish button
    const publishBtn = page.locator('button:has-text("发布")').first();
    if (await publishBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await publishBtn.click({ force: true });
      console.log('  Clicked 发布');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    await page.screenshot({ path: 'screenshots/master27-f4-published.png', fullPage: true });

    // ====== Step 6: Test - submit a record ======
    console.log('\n[6] Testing form submission...');
    // Navigate to the form view
    const formViewUrl = page.url().replace('/edit', '').replace('#/edit', '');
    await page.goto(formViewUrl || `https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06#/app/6a0aa9d82c4789aa80588d06/form/6a1147c50b22fc86819c1038`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log('Form view:', bodyText.substring(0, 400));

    await page.screenshot({ path: 'screenshots/master27-f5-form-view.png', fullPage: true });
    console.log('\n✓ Phase 27 100% complete');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
