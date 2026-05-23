/**
 * Fix ALL form fields: rename, configure data sources
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function selectField(page: any, fieldName: string) {
  const el = page.locator(`.field-name:text-is("${fieldName}")`).first();
  if (await el.count() > 0) {
    await el.click({ force: true });
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

async function renameField(page: any, newName: string) {
  const input = page.locator('[class*="config"] input').first();
  if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
    await input.fill(newName);
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

async function setDataSource(page: any, formName: string) {
  const dd = page.locator('[class*="config"] .x-biz-dropdown-label').first();
  if (await dd.count() > 0 && await dd.isVisible({ timeout: 500 }).catch(() => false)) {
    await dd.click({ force: true });
    await page.waitForTimeout(800);
    const entry = page.locator(`[class*="popover"] .entry-item:has-text("${formName}")`).first();
    if (await entry.count() > 0 && await entry.isVisible({ timeout: 1000 }).catch(() => false)) {
      await entry.click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function saveForm(page: any) {
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) (btn as HTMLButtonElement).click();
    }
  });
  await page.waitForTimeout(3000); await waitForStableDOM(page);
}

async function main() {
  console.log('[FIX ALL FORMS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Fix 采购订单 ======
    console.log('[1] Fixing 采购订单...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a11616d0ae602c1e08008a9/edit#/edit', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(3000);

    // Rename "计算" to "金额" in sub-form - click into the sub-form first
    // Click the sub-form to enter it
    const subFormEl = page.locator('.field-name:text-is("采购明细")').first();
    if (await subFormEl.count() > 0) {
      await subFormEl.click({ force: true });
      console.log('  Clicked 采购明细 sub-form');
      await page.waitForTimeout(1000);
    }

    // Now click "计算" field inside sub-form
    if (await selectField(page, '计算')) {
      await renameField(page, '金额');
      console.log('  计算 → 金额');
    }

    await saveForm(page);
    console.log('  采购订单 saved');

    await page.screenshot({ path: 'screenshots/erp-fix-po.png', fullPage: true });

    // ====== Fix 销售订单 ======
    console.log('\n[2] Fixing 销售订单...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1161900ae602c1e0802318/edit#/edit', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(3000);

    // Select "客户" field and set data source to 客户资料
    if (await selectField(page, '客户')) {
      await setDataSource(page, '客户资料');
      console.log('  客户 → data source: 客户资料');
    }

    // Click into sub-form 销售明细
    const soSubForm = page.locator('.field-name:text-is("销售明细")').first();
    if (await soSubForm.count() > 0) {
      await soSubForm.click({ force: true });
      console.log('  Clicked 销售明细 sub-form');
      await page.waitForTimeout(1000);
    }

    // Rename 计算 to 金额
    if (await selectField(page, '计算')) {
      await renameField(page, '金额');
      console.log('  计算 → 金额');
    }

    // Select 商品 field and set data source
    if (await selectField(page, '商品')) {
      await setDataSource(page, '商品资料');
      console.log('  商品 → data source: 商品资料');
    }

    await saveForm(page);
    console.log('  销售订单 saved');

    await page.screenshot({ path: 'screenshots/erp-fix-so.png', fullPage: true });

    // ====== Fix 采购入库单 ======
    console.log('\n[3] Fixing 采购入库单...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1173664242e8826b8feb0f/edit#/edit', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(3000);

    // Select 关联采购单 and set data source
    if (await selectField(page, '关联采购单')) {
      await setDataSource(page, '采购订单');
      console.log('  关联采购单 → 采购订单');
    }

    // Click into 明细 sub-form
    const rcSubForm = page.locator('.field-name:text-is("明细")').first();
    if (await rcSubForm.count() > 0) {
      await rcSubForm.click({ force: true });
      console.log('  Clicked 明细 sub-form');
      await page.waitForTimeout(1000);
    }

    // Select 商品 field and set data source
    if (await selectField(page, '商品')) {
      await setDataSource(page, '商品资料');
      console.log('  商品 → 商品资料');
    }

    await saveForm(page);
    console.log('  采购入库单 saved');

    // ====== Fix 销售出库单 ======
    console.log('\n[4] Fixing 销售出库单...');
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a117380567db19ff271c15b/edit#/edit', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page); await page.waitForTimeout(3000);

    // Select 关联销售单 and set data source
    if (await selectField(page, '关联销售单')) {
      await setDataSource(page, '销售订单');
      console.log('  关联销售单 → 销售订单');
    }

    await saveForm(page);
    console.log('  销售出库单 saved');

    await page.screenshot({ path: 'screenshots/erp-fix-all.png', fullPage: true });

    console.log('\n[DONE] All form fields fixed');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
