/**
 * Full ERP build - All stages per design document
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06';

async function renameApp(page: any) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page); await page.waitForTimeout(2000);
  await page.locator(':text("应用后台")').first().click({ force: true });
  await page.waitForTimeout(2000); await waitForStableDOM(page);
  await page.locator('.x-navigation-item:has-text("应用设置")').last().click({ force: true });
  await page.waitForTimeout(1500); await waitForStableDOM(page);

  await page.locator('button:has-text("修改")').first().click({ force: true });
  await page.waitForTimeout(500);
  const input = page.locator('input').first();
  if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
    await input.fill('进销存系统（训练版）');
    await page.keyboard.press('Enter');
    console.log('[OK] App renamed to 进销存系统（训练版）');
    await page.waitForTimeout(2000);
  }
}

async function enterTestData(page: any, formName: string, data: Record<string, string>) {
  // Navigate to form
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page); await page.waitForTimeout(2000);

  const menuItem = page.locator(`span.node-content-wrapper:has-text("${formName}")`).first();
  if (await menuItem.count() > 0) {
    await menuItem.click({ force: true });
    await page.waitForTimeout(2000); await waitForStableDOM(page);
  }

  // Fill fields
  for (const [key, value] of Object.entries(data)) {
    const inputs = page.locator('input:not([type="hidden"]):not([type="checkbox"])');
    const cnt = await inputs.count();
    for (let i = 0; i < cnt; i++) {
      const inp = inputs.nth(i);
      if (await inp.isVisible({ timeout: 300 }).catch(() => false)) {
        const currentVal = await inp.inputValue().catch(() => '');
        if (currentVal === '' || currentVal === '0') {
          await inp.fill(value);
          await page.waitForTimeout(200);
          break;
        }
      }
    }
  }

  // Submit
  const submitBtn = page.locator('button:has-text("提交")').first();
  if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await submitBtn.click({ force: true });
    await page.waitForTimeout(3000); await waitForStableDOM(page);
  }

  const result = await page.locator('body').first().innerText().catch(() => '');
  const success = result.includes('提交成功');
  console.log(`  [TEST] ${formName}: ${success ? 'PASS' : 'FAIL'}`);
  await page.screenshot({ path: `screenshots/erp-test-${formName}.png`, fullPage: true });
  return success;
}

async function main() {
  console.log('[ERP BUILD] Starting full build...\n');
  const wd = startWatchdog({ hardTimeoutMs: 900_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Step 1: Rename app ======
    console.log('[1] Rename app');
    await renameApp(page);
    await page.screenshot({ path: 'screenshots/erp-1-renamed.png', fullPage: true });

    // ====== Step 2: Test data for Stage 1 基础资料 ======
    console.log('\n[2] Testing 基础资料...');

    await enterTestData(page, '商品资料', { '商品编码': 'SP001', '商品名称': 'iPhone 15' });
    await enterTestData(page, '商品资料', { '商品编码': 'SP002', '商品名称': 'MateBook X' });
    await enterTestData(page, '商品资料', { '商品编码': 'SP003', '商品名称': '小米电视' });

    await enterTestData(page, '客户资料', { '客户编号': 'KH001', '客户名称': '深圳腾讯', '联系人': '张三', '联系电话': '13800000001' });
    await enterTestData(page, '客户资料', { '客户编号': 'KH002', '客户名称': '阿里巴巴', '联系人': '李四', '联系电话': '13800000002' });

    await enterTestData(page, '供应商资料', { '供应商编号': 'GYS001', '供应商名称': '富士康', '联系人': '王总' });
    await enterTestData(page, '供应商资料', { '供应商编号': 'GYS002', '供应商名称': '京东方', '联系人': '刘总' });

    console.log('\n[ERP BUILD] Basic data test complete');

    await page.screenshot({ path: 'screenshots/erp-final-state.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
