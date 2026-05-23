/**
 * 诊断子表数据提交流程 - 检查网络请求和事件触发
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

async function main() {
  console.log('[DIAG SUBTABLE SUBMIT]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Capture network requests
    const apiCalls: any[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('api') || url.includes('submit') || url.includes('save') || url.includes('create')) {
        apiCalls.push({
          type: 'request',
          url: url.substring(0, 200),
          method: req.method(),
          postData: req.postData()?.substring(0, 2000),
        });
      }
    });
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('api') || url.includes('submit') || url.includes('save') || url.includes('create')) {
        apiCalls.push({
          type: 'response',
          url: url.substring(0, 200),
          status: res.status(),
        });
      }
    });

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
      await formInputs.nth(0).fill('ORD-20260523-NET');
      await formInputs.nth(1).fill('2026-05-23');
    }

    // Select customer and product
    const assocBtn = page.locator('.fx-form.form-modal button:has-text("关联数据")').first();
    await assocBtn.click({ force: true });
    await selectInDialog(page, '张三');
    const chooseBtn = page.locator('.fx-form.form-modal button:has-text("选择数据")').first();
    await chooseBtn.click({ force: true });
    await selectInDialog(page, '智能手机');

    // Add subtable row
    const subAddBtn = page.locator('button.btn-add').first();
    await subAddBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // Fill subtable using type() instead of fill() to trigger events
    const subInputs = page.locator('.fx-related-form input:not([type="hidden"]):not([type="checkbox"])');
    const siCount = await subInputs.count();
    console.log(`子表输入框数量: ${siCount}`);

    if (siCount >= 4) {
      // Method: click, clear, then type character by character to trigger input events
      for (let i = 0; i < 4; i++) {
        const inp = subInputs.nth(i);
        await inp.click({ force: true });
        await page.waitForTimeout(200);
        // Triple-click to select all, then type
        await inp.click({ force: true, clickCount: 3 });
        await page.waitForTimeout(100);
        const values = ['智能手机', '2', '2999', '5998'];
        await inp.fill(values[i]);
        // Dispatch input event to ensure reactivity
        await inp.evaluate((el, val) => {
          const input = el as HTMLInputElement;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set;
          nativeInputValueSetter?.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }, values[i]);
        await page.waitForTimeout(300);
        console.log(`  [${i}] filled with "${values[i]}"`);
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/diag-net-1-filled.png', fullPage: true });

    // Check subtable state
    const subState = await page.evaluate(() => {
      const subtable = document.querySelector('.fx-related-form');
      if (!subtable) return { error: 'no subtable' };
      const inputs = [...subtable.querySelectorAll('input:not([type="hidden"])')];
      return {
        inputCount: inputs.length,
        values: inputs.map(i => (i as HTMLInputElement).value),
        subtableText: (subtable as HTMLElement).innerText?.trim()?.substring(0, 300),
      };
    });
    console.log(`\n提交前子表状态: ${JSON.stringify(subState)}`);

    // Clear API calls before submit
    apiCalls.length = 0;

    // Submit
    console.log('\n====== 提交 ======');
    const submitBtn = page.locator('.fx-form.form-modal button:has-text("提交")').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);

    console.log(`\nAPI调用 (${apiCalls.length}个):`);
    apiCalls.forEach(c => console.log(`  ${c.type}: ${c.method || ''} ${c.url} ${c.status || ''}`));

    // Find the submit/create API call
    const submitCall = apiCalls.find(c => c.type === 'request' && c.postData);
    if (submitCall) {
      console.log(`\n提交数据:\n${submitCall.postData}`);
    }

    await page.screenshot({ path: 'screenshots/diag-net-2-result.png', fullPage: true });

    // Check result
    const resultText = await page.locator('body').first().innerText().catch(() => '');
    const hasNewRecord = resultText.includes('ORD-20260523-NET');
    console.log(`\n新记录出现: ${hasNewRecord ? '✓' : '✗'}`);

    // Check 订单明细表
    console.log('\n====== 检查订单明细表 ======');
    await page.locator('.tree-node').filter({ hasText: '订单明细表' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const detailText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`订单明细表:\n${detailText.substring(0, 1500)}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
