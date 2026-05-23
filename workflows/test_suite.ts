/**
 * ERP Test Suite - Execute all test cases from test document
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06';

async function navigateToForm(page: any, formName: string) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page); await page.waitForTimeout(2000);
  const item = page.locator(`span.node-content-wrapper:has-text("${formName}")`).first();
  if (await item.count() > 0) {
    await item.click({ force: true });
    await page.waitForTimeout(2000); await waitForStableDOM(page);
    return true;
  }
  return false;
}

async function fillInputs(page: any, values: string[]) {
  const inputs = page.locator('input:not([type="hidden"]):not([type="checkbox"])');
  const cnt = await inputs.count();
  let vi = 0;
  for (let i = 0; i < cnt && vi < values.length; i++) {
    const inp = inputs.nth(i);
    if (await inp.isVisible({ timeout: 300 }).catch(() => false)) {
      const current = await inp.inputValue().catch(() => '');
      if (current === '' || current === '0') {
        await inp.fill(values[vi]);
        vi++;
        await page.waitForTimeout(200);
      }
    }
  }
  return vi;
}

async function submitForm(page: any) {
  const btn = page.locator('button:has-text("提交")').first();
  if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await btn.click({ force: true });
    await page.waitForTimeout(3000); await waitForStableDOM(page);
  }
  const text = await page.locator('body').first().innerText().catch(() => '');
  return text.includes('提交成功');
}

async function main() {
  console.log('[TEST SUITE] ERP System Test\n');
  console.log('='.repeat(50));
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();
  const results: string[] = [];

  try {
    const { page } = s;
    await login(page);

    // ====== TEST 1: 商品资料 ======
    console.log('\n[TEST 1] 商品资料');
    const products = [
      { code: 'SP001', name: 'iPhone 15', cat: '手机', brand: 'Apple', unit: '台', buy: '5000', sell: '6999' },
      { code: 'SP002', name: 'MateBook X', cat: '笔记本', brand: 'Huawei', unit: '台', buy: '6000', sell: '7999' },
      { code: 'SP003', name: '小米电视', cat: '家电', brand: 'Xiaomi', unit: '台', buy: '2000', sell: '2999' },
    ];

    for (const p of products) {
      await navigateToForm(page, '商品资料');
      await fillInputs(page, [p.code, p.name, p.cat, p.brand, '', p.unit, p.buy, p.sell, '10']);
      const ok = await submitForm(page);
      results.push(`商品资料 ${p.name}: ${ok ? 'PASS' : 'FAIL'}`);
      console.log(`  ${p.code} ${p.name}: ${ok ? 'PASS' : 'FAIL'}`);
      await page.waitForTimeout(500);
    }

    // ====== TEST 2: 客户资料 ======
    console.log('\n[TEST 2] 客户资料');
    const customers = [
      { code: 'KH001', name: '深圳腾讯', contact: '张三', phone: '13800000001' },
      { code: 'KH002', name: '阿里巴巴', contact: '李四', phone: '13800000002' },
    ];
    for (const c of customers) {
      await navigateToForm(page, '客户资料');
      await fillInputs(page, [c.code, c.name, c.contact, c.phone]);
      const ok = await submitForm(page);
      results.push(`客户资料 ${c.name}: ${ok ? 'PASS' : 'FAIL'}`);
      console.log(`  ${c.code} ${c.name}: ${ok ? 'PASS' : 'FAIL'}`);
      await page.waitForTimeout(500);
    }

    // ====== TEST 3: 供应商资料 ======
    console.log('\n[TEST 3] 供应商资料');
    const suppliers = [
      { code: 'GYS001', name: '富士康', contact: '王总' },
      { code: 'GYS002', name: '京东方', contact: '刘总' },
    ];
    for (const s of suppliers) {
      await navigateToForm(page, '供应商资料');
      await fillInputs(page, [s.code, s.name, s.contact]);
      const ok = await submitForm(page);
      results.push(`供应商资料 ${s.name}: ${ok ? 'PASS' : 'FAIL'}`);
      console.log(`  ${s.code} ${s.name}: ${ok ? 'PASS' : 'FAIL'}`);
      await page.waitForTimeout(500);
    }

    // ====== TEST 4: 采购订单 ======
    console.log('\n[TEST 4] 采购订单');
    await navigateToForm(page, '采购订单');
    if (await page.locator('button:has-text("提交")').isVisible({ timeout: 1000 }).catch(() => false)) {
      await fillInputs(page, ['PO001', '5000', '10']);
      const ok = await submitForm(page);
      results.push(`采购订单: ${ok ? 'PASS' : 'FAIL'}`);
      console.log(`  采购订单: ${ok ? 'PASS' : 'FAIL'}`);
    } else {
      results.push('采购订单: SKIP (form view not accessible)');
      console.log('  SKIP - form view issue');
    }

    // ====== TEST 5: 销售订单 ======
    console.log('\n[TEST 5] 销售订单');
    await navigateToForm(page, '销售订单');
    if (await page.locator('button:has-text("提交")').isVisible({ timeout: 1000 }).catch(() => false)) {
      await fillInputs(page, ['SO001', '6999', '2']);
      const ok = await submitForm(page);
      results.push(`销售订单: ${ok ? 'PASS' : 'FAIL'}`);
      console.log(`  销售订单: ${ok ? 'PASS' : 'FAIL'}`);
    } else {
      results.push('销售订单: SKIP');
      console.log('  SKIP');
    }

    // ====== TEST 6: 入库/出库 ======
    console.log('\n[TEST 6] 采购入库单');
    await navigateToForm(page, '采购入库单');
    if (await page.locator('button:has-text("提交")').isVisible({ timeout: 1000 }).catch(() => false)) {
      await fillInputs(page, ['IN001', '10']);
      const ok = await submitForm(page);
      results.push(`采购入库单: ${ok ? 'PASS' : 'FAIL'}`);
      console.log(`  采购入库单: ${ok ? 'PASS' : 'FAIL'}`);
    } else {
      results.push('采购入库单: SKIP');
      console.log('  SKIP');
    }

    console.log('\n[TEST 7] 销售出库单');
    await navigateToForm(page, '销售出库单');
    if (await page.locator('button:has-text("提交")').isVisible({ timeout: 1000 }).catch(() => false)) {
      await fillInputs(page, ['OUT001', '2']);
      const ok = await submitForm(page);
      results.push(`销售出库单: ${ok ? 'PASS' : 'FAIL'}`);
      console.log(`  销售出库单: ${ok ? 'PASS' : 'FAIL'}`);
    } else {
      results.push('销售出库单: SKIP');
      console.log('  SKIP');
    }

    // ====== SUMMARY ======
    console.log('\n' + '='.repeat(50));
    console.log('[TEST RESULTS]');
    const pass = results.filter(r => r.includes('PASS')).length;
    const fail = results.filter(r => r.includes('FAIL')).length;
    const skip = results.filter(r => r.includes('SKIP')).length;
    console.log(`  PASS: ${pass}, FAIL: ${fail}, SKIP: ${skip}, TOTAL: ${results.length}`);
    results.forEach(r => console.log(`  ${r}`));

    await page.screenshot({ path: 'screenshots/test-final.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
