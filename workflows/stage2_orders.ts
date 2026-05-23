/**
 * Stage 2: 采购订单 + 销售订单 (主子表结构)
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06';

async function navigateToFormEditor(page: any, formId: string) {
  await page.goto(`https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/${formId}/edit#/edit`, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);
}

async function addFieldToForm(page: any, fieldType: string, fieldName: string) {
  let retries = 0;
  while (retries < 3) {
    // Scroll the field type into view in the left panel
    const typeEl = page.locator(`:text-is("${fieldType}")`).first();
    const typeCount = await typeEl.count();
    if (typeCount > 0) {
      try {
        await typeEl.scrollIntoViewIfNeeded();
        await typeEl.click({ force: true });
        await page.waitForTimeout(1000);
        console.log(`    [SELECTOR] Added: ${fieldName} (${fieldType})`);

        // Try to set field name
        try {
          const titleInput = page.locator('[class*="field-config"] input, [class*="property"] input, [class*="config"] input').first();
          if (await titleInput.isVisible({ timeout: 800 }).catch(() => false)) {
            const currentVal = await titleInput.inputValue().catch(() => '');
            if (currentVal === fieldType || currentVal !== fieldName) {
              await titleInput.fill(fieldName);
              await page.waitForTimeout(300);
            }
          }
        } catch { /* field name setting is best-effort */ }

        return true;
      } catch { /* retry */ }
    }
    retries++;
    console.log(`    [RECOVERY] Retry ${retries} for ${fieldName}`);
    await page.waitForTimeout(500);
  }
  console.log(`    [ERROR] Failed: ${fieldName}`);
  return false;
}

async function fillFieldName(page: any, fieldName: string) {
  try {
    const inputs = page.locator('input');
    const cnt = await inputs.count();
    for (let i = 0; i < cnt; i++) {
      const inp = inputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      if (val === '子表单' || val === '单行文本' || val === '数字' || val === '') {
        await inp.fill(fieldName);
        await page.waitForTimeout(300);
        return;
      }
    }
  } catch { /* best effort */ }
}

async function main() {
  console.log('[STAGE 2] 采购/销售订单\n');
  const wd = startWatchdog({ hardTimeoutMs: 900_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Create 采购订单 form ======
    console.log('[WORKFLOW] Creating 采购订单...');

    // Create new form
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const btn = document.querySelector('button.add-button') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(800);
    await page.locator('.x-menu-item:has-text("新建表单")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    if (bodyText.includes('创建空白表单')) {
      await page.locator(':text-is("创建空白表单")').first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    // Rename
    const titleArea = page.locator('[class*="title"]').first();
    if (await titleArea.count() > 0) { await titleArea.click({ force: true }); await page.waitForTimeout(500); }
    const nameInput = page.locator('input').first();
    if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await nameInput.fill('采购订单');
      await page.keyboard.press('Enter');
      console.log('  [SAVE] Named: 采购订单');
      await page.waitForTimeout(1000);
    }

    const poFormId = page.url().match(/form\/([a-f0-9]+)\/edit/)?.[1] || 'unknown';
    console.log(`  Form ID: ${poFormId}`);

    // Add main table fields
    console.log('  Adding main fields...');
    await addFieldToForm(page, '单行文本', '采购单号');
    await addFieldToForm(page, '关联查询', '供应商');
    await addFieldToForm(page, '日期时间', '采购日期');
    await addFieldToForm(page, '成员单选', '采购员');
    await addFieldToForm(page, '数字', '总金额');
    await addFieldToForm(page, '单选按钮组', '状态');
    await addFieldToForm(page, '多行文本', '备注');

    // Add 子表单 for 采购明细
    console.log('  Adding sub-form: 采购明细');
    await addFieldToForm(page, '子表单', '采购明细');

    // Now add fields INSIDE the sub-form. Click on the sub-form to enter it
    // The sub-form fields are added when the sub-form is selected
    // Click on the sub-form in the form design area
    const subFormEl = page.locator('[class*="sub-form"], [class*="related"]:has-text("采购明细")').first();
    if (await subFormEl.count() > 0) {
      await subFormEl.click({ force: true });
      console.log('  Clicked sub-form');
      await page.waitForTimeout(1000);
    }

    // Add sub-form fields
    await addFieldToForm(page, '选择数据', '商品');
    await addFieldToForm(page, '关联数据', '商品编码');
    await addFieldToForm(page, '数字', '数量');
    await addFieldToForm(page, '数字', '单价');
    await addFieldToForm(page, '公式', '金额');

    // Save
    console.log('  [SAVE] Saving 采购订单...');
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
        }
      }
    });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/stage2-po.png', fullPage: true });

    // ====== Create 销售订单 form ======
    console.log('\n[WORKFLOW] Creating 销售订单...');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    await page.evaluate(() => { const btn = document.querySelector('button.add-button') as HTMLButtonElement; if (btn) btn.click(); });
    await page.waitForTimeout(800);
    await page.locator('.x-menu-item:has-text("新建表单")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
    bodyText = await page.locator('body').first().innerText().catch(() => '');
    if (bodyText.includes('创建空白表单')) {
      await page.locator(':text-is("创建空白表单")').first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    const titleArea2 = page.locator('[class*="title"]').first();
    if (await titleArea2.count() > 0) { await titleArea2.click({ force: true }); await page.waitForTimeout(500); }
    const nameInput2 = page.locator('input').first();
    if (await nameInput2.isVisible({ timeout: 500 }).catch(() => false)) {
      await nameInput2.fill('销售订单');
      await page.keyboard.press('Enter');
      console.log('  [SAVE] Named: 销售订单');
      await page.waitForTimeout(1000);
    }
    const soFormId = page.url().match(/form\/([a-f0-9]+)\/edit/)?.[1] || 'unknown';
    console.log(`  Form ID: ${soFormId}`);

    // Add main table fields
    await addFieldToForm(page, '单行文本', '销售单号');
    await addFieldToForm(page, '选择数据', '客户');
    await addFieldToForm(page, '日期时间', '销售日期');
    await addFieldToForm(page, '成员单选', '销售员');
    await addFieldToForm(page, '数字', '总金额');
    await addFieldToForm(page, '单选按钮组', '状态');

    // Add sub-form
    await addFieldToForm(page, '子表单', '销售明细');
    const subFormEl2 = page.locator('[class*="sub-form"]:has-text("销售明细")').first();
    if (await subFormEl2.count() > 0) {
      await subFormEl2.click({ force: true });
      console.log('  Clicked sub-form');
      await page.waitForTimeout(1000);
    }

    await addFieldToForm(page, '选择数据', '商品');
    await addFieldToForm(page, '数字', '数量');
    await addFieldToForm(page, '数字', '单价');
    await addFieldToForm(page, '公式', '金额');

    console.log('  [SAVE] Saving 销售订单...');
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
          (btn as HTMLButtonElement).click();
        }
      }
    });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/stage2-so.png', fullPage: true });

    console.log('\n[WORKFLOW] Stage 2 complete!');
    console.log(`  采购订单 ID: ${poFormId}`);
    console.log(`  销售订单 ID: ${soFormId}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
