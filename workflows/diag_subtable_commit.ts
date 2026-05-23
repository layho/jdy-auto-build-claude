/**
 * 诊断子表行提交机制 - 填完数据后详细检查DOM
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function selectInDialog(page: Page, rowText: string): Promise<void> {
  await page.waitForTimeout(1500);
  for (const sel of ['.fx-lookup-dialog', '.fx-linkfield-dialog']) {
    const dlg = page.locator(sel).first();
    if (await dlg.isVisible().catch(() => false)) {
      const row = dlg.locator('tbody tr').filter({ hasText: rowText }).first();
      if (await row.count() > 0) {
        await row.click({ force: true });
        await page.waitForTimeout(1500);
      }
    }
  }
}

async function dumpSubtableState(page: Page, label: string) {
  const state = await page.evaluate(() => {
    const subtable = document.querySelector('.fx-related-form');
    if (!subtable) return { error: 'no subtable' };

    // All buttons in subtable
    const buttons = [...subtable.querySelectorAll('button, [role="button"], .btn, [class*="btn"]')];
    // All clickable elements
    const clickables = [...subtable.querySelectorAll('[class*="operate"], [class*="action"], [class*="icon"], i, svg')];

    // Input details
    const inputs = [...subtable.querySelectorAll('input:not([type="hidden"])')];

    // Row details
    const rows = [...subtable.querySelectorAll('[class*="row"]')];
    const rowDetails = rows.map((r, i) => ({
      index: i,
      className: (r as HTMLElement).className?.substring(0, 200),
      innerHTML: (r as HTMLElement).innerHTML?.substring(0, 500),
      innerText: (r as HTMLElement).innerText?.trim(),
    }));

    return {
      buttons: buttons.map(b => ({
        tag: b.tagName,
        text: (b as HTMLElement).innerText?.trim() || b.getAttribute('title') || '',
        class: (b as HTMLElement).className?.substring(0, 120),
        visible: !!(b as HTMLElement).offsetParent,
      })),
      clickableIcons: clickables.map(c => ({
        tag: c.tagName,
        class: (c as HTMLElement).className?.substring(0, 120),
        title: c.getAttribute('title') || '',
        visible: !!(c as HTMLElement).offsetParent,
      })).filter(c => c.visible).slice(0, 30),
      inputs: inputs.map(inp => ({
        class: (inp as HTMLElement).className?.substring(0, 120),
        value: (inp as HTMLInputElement).value,
        placeholder: (inp as HTMLInputElement).placeholder,
        type: (inp as HTMLInputElement).type,
        readOnly: (inp as HTMLInputElement).readOnly,
      })),
      rowCount: rows.length,
      rowDetails: rowDetails.slice(0, 10),
      fullHTML: (subtable as HTMLElement).innerHTML?.substring(0, 3000),
    };
  });

  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(state, null, 2));
}

async function main() {
  console.log('[DIAG SUBTABLE COMMIT]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Open form
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // Fill basic info
    const formInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    if (await formInputs.count() >= 2) {
      await formInputs.nth(0).fill('ORD-20260523-DIAG');
      await formInputs.nth(1).fill('2026-05-23');
    }

    // Select customer and product
    const assocBtn = page.locator('.fx-form.form-modal button:has-text("关联数据")').first();
    await assocBtn.click({ force: true });
    await selectInDialog(page, '张三');

    const chooseBtn = page.locator('.fx-form.form-modal button:has-text("选择数据")').first();
    await chooseBtn.click({ force: true });
    await selectInDialog(page, '智能手机');

    // ====== Add subtable row ======
    const subAddBtn = page.locator('button.btn-add').first();
    await subAddBtn.click({ force: true });
    await page.waitForTimeout(2000);

    await dumpSubtableState(page, 'AFTER ADD ROW');

    // Fill subtable inputs
    const subInputs = page.locator('.fx-related-form input:not([type="hidden"]):not([type="checkbox"])');
    const siCount = await subInputs.count();
    console.log(`\n子表输入框数量: ${siCount}`);

    if (siCount >= 4) {
      await subInputs.nth(0).fill('智能手机');
      await subInputs.nth(1).fill('2');
      await subInputs.nth(2).fill('2999');
      await subInputs.nth(3).fill('5998');
      console.log('已填写子表数据');
    }

    await dumpSubtableState(page, 'AFTER FILL DATA');

    // Try various commit methods and check state after each
    // Method 1: Press Tab to move out of last field
    await subInputs.nth(3).press('Tab');
    await page.waitForTimeout(1000);
    await dumpSubtableState(page, 'AFTER TAB');

    // Method 2: Click on a header cell
    const headers = page.locator('.related-form-title').first();
    if (await headers.count() > 0) {
      await headers.click({ force: true });
      await page.waitForTimeout(1000);
      await dumpSubtableState(page, 'AFTER CLICK HEADER');
    }

    // Method 3: Press Enter on last input
    await subInputs.nth(3).press('Enter');
    await page.waitForTimeout(1000);
    await dumpSubtableState(page, 'AFTER ENTER ON LAST INPUT');

    // Method 4: Try clicking the row number area
    const rowNum = page.locator('.fx-related-form [class*="row-num"], .fx-related-form [class*="row-index"]').first();
    if (await rowNum.count() > 0) {
      await rowNum.click({ force: true });
      await page.waitForTimeout(1000);
      await dumpSubtableState(page, 'AFTER CLICK ROW NUM');
    }

    // Method 5: Look for a checkmark/confirm icon
    const confirmIcons = page.locator('.fx-related-form [class*="check"], .fx-related-form [class*="confirm"], .fx-related-form [class*="save"], .fx-related-form i[class*="ok"]');
    const ciCount = await confirmIcons.count();
    console.log(`\n确认图标数量: ${ciCount}`);
    if (ciCount > 0) {
      for (let i = 0; i < ciCount; i++) {
        const cls = await confirmIcons.nth(i).getAttribute('class');
        console.log(`  图标[${i}]: class=${cls}`);
      }
    }

    await page.screenshot({ path: 'screenshots/diag-commit-state.png', fullPage: true });

    // Try submitting anyway
    console.log('\n====== 尝试提交 ======');
    const submitBtn = page.locator('.fx-form.form-modal button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('已点击提交');
      await page.waitForTimeout(4000);
    }

    const resultText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`提交结果: ${resultText.substring(0, 500)}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
