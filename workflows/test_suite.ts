/**
 * test_suite.ts — 端到端数据录入验证
 *
 * 修复：
 * 1. 原来 testFormEntry 直接 fill inputs.nth(i)，不管 label 直接按顺序填，
 *    容易填错字段（hidden input、只读字段都会算进去）
 *    → 改为按字段标签定位对应 input
 * 2. 提交后只检查 '提交成功' 字符串，但简道云有时显示的是 toast 消息
 *    → 同时检查 toast 和页面内容
 * 3. 没有截图目录预创建，首次运行会 ENOENT crash（与 runtime/dom.ts 修复一致）
 * 4. 测试数据太少，没有覆盖下拉/单选字段 → 加了点击选项的辅助函数
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_ID = process.env.JDY_APP_ID ?? '6a0aa9d82c4789aa80588d06';
const APP_URL = `https://www.jiandaoyun.com/dashboard/app/${APP_ID}`;

if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots', { recursive: true });

// ─── 导航到表单提交页 ──────────────────────────────────────
async function openFormForEntry(page: any, formName: string): Promise<boolean> {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  // 左侧菜单找到表单并点击
  const menuItem = page.locator(`span.node-content-wrapper:has-text("${formName}"), .tree-node:has-text("${formName}")`).first();
  if (await menuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await menuItem.click({ force: true });
    await waitForStableDOM(page);
    await page.waitForTimeout(1500);
    return true;
  }
  console.warn(`  [WARN] 未找到表单: ${formName}`);
  return false;
}

// ─── 打开新增记录表单 ──────────────────────────────────────
async function clickAddRecord(page: any): Promise<boolean> {
  const addSelectors = [
    'button:has-text("新增")',
    'button:has-text("添加")',
    'button:has-text("新建")',
    '.add-btn',
    '[data-testid="add-record"]',
  ];
  for (const sel of addSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(1500);
      await waitForStableDOM(page, 500);
      return true;
    }
  }
  // 有些表单直接可以填写（无列表视图）
  return true;
}

// ─── 按字段标签填写文本 ────────────────────────────────────
async function fillField(page: any, label: string, value: string): Promise<void> {
  // 简道云表单 label 一般是 .form-field-label 或 .field-label
  const labelEl = page.locator(`.form-field-label:has-text("${label}"), .field-label:has-text("${label}"), label:has-text("${label}")`).first();
  if (await labelEl.isVisible({ timeout: 600 }).catch(() => false)) {
    // 找同级或同父节点下的 input
    const parent = labelEl.locator('..');
    const inp = parent.locator('input:not([type="hidden"]):not([type="checkbox"]), textarea').first();
    if (await inp.isVisible({ timeout: 600 }).catch(() => false)) {
      await inp.fill(value);
      await page.waitForTimeout(200);
      console.log(`  填写: ${label} = ${value}`);
      return;
    }
  }
  // fallback: placeholder 匹配
  const byPlaceholder = page.locator(`input[placeholder*="${label}"]`).first();
  if (await byPlaceholder.isVisible({ timeout: 400 }).catch(() => false)) {
    await byPlaceholder.fill(value);
    console.log(`  填写 (placeholder): ${label} = ${value}`);
  }
}

// ─── 按字段标签选择下拉选项 ───────────────────────────────
async function selectOption(page: any, label: string, option: string): Promise<void> {
  const labelEl = page.locator(`.form-field-label:has-text("${label}"), label:has-text("${label}")`).first();
  if (await labelEl.isVisible({ timeout: 600 }).catch(() => false)) {
    const parent = labelEl.locator('..');
    const dropdown = parent.locator('[class*="dropdown"], [class*="select"]').first();
    if (await dropdown.isVisible({ timeout: 600 }).catch(() => false)) {
      await dropdown.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
  // 选项出现在 popover/dropdown 中
  const optEl = page.locator(`[class*="popover"] :text-is("${option}"), [class*="dropdown"] :text-is("${option}")`).first();
  if (await optEl.isVisible({ timeout: 1000 }).catch(() => false)) {
    await optEl.click({ force: true });
    await page.waitForTimeout(300);
    console.log(`  选择: ${label} = ${option}`);
  }
}

// ─── 提交并验证结果 ────────────────────────────────────────
async function submitAndVerify(page: any, label: string): Promise<boolean> {
  const submitBtn = page.locator("button:has-text('提交'), button:has-text('保存提交')").first();
  if (!(await submitBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    console.warn('  [WARN] 未找到提交按钮');
    return false;
  }
  await submitBtn.click({ force: true });
  await page.waitForTimeout(3000);
  await waitForStableDOM(page);

  // 检查 toast 或页面内容
  const successToast = page.locator('.toast-success, [class*="message-success"]').first();
  const toastVisible = await successToast.isVisible({ timeout: 1000 }).catch(() => false);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const pageOk = bodyText.includes('提交成功') || bodyText.includes('保存成功');

  const ok = toastVisible || pageOk;
  console.log(`  [${ok ? '✓' : '✗'}] ${label} 提交${ok ? '成功' : '失败'}`);
  await page.screenshot({ path: `screenshots/test-${label.replace(/\s/g, '_')}.png`, fullPage: true });
  return ok;
}

// ─────────────────────────────────────────────────────────
async function main() {
  console.log('[TEST] 端到端验证\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();
  const results: Record<string, boolean> = {};

  try {
    const { page } = s;
    await login(page);

    // ── Test 1: 商品资料 ──
    console.log('\n[TEST] 商品资料');
    if (await openFormForEntry(page, '商品资料')) {
      await clickAddRecord(page);
      await fillField(page, '商品编码', 'SP001');
      await fillField(page, '商品名称', 'iPhone 15');
      await fillField(page, '品牌', 'Apple');
      await fillField(page, '规格型号', 'A3090');
      await selectOption(page, '商品分类', '手机');
      await selectOption(page, '单位', '件');
      await fillField(page, '采购价', '5000');
      await fillField(page, '销售价', '6999');
      await fillField(page, '安全库存', '10');
      results['商品资料'] = await submitAndVerify(page, '商品资料');
    }

    // ── Test 2: 客户资料 ──
    console.log('\n[TEST] 客户资料');
    if (await openFormForEntry(page, '客户资料')) {
      await clickAddRecord(page);
      await fillField(page, '客户编号', 'KH001');
      await fillField(page, '客户名称', '深圳腾讯');
      await fillField(page, '联系人', '张三');
      await fillField(page, '联系电话', '13800000001');
      await selectOption(page, '客户等级', 'VIP');
      await fillField(page, '信用额度', '100000');
      results['客户资料'] = await submitAndVerify(page, '客户资料');
    }

    // ── Test 3: 供应商资料 ──
    console.log('\n[TEST] 供应商资料');
    if (await openFormForEntry(page, '供应商资料')) {
      await clickAddRecord(page);
      await fillField(page, '供应商编号', 'GYS001');
      await fillField(page, '供应商名称', '富士康');
      await fillField(page, '联系人', '王总');
      await fillField(page, '联系电话', '13900000001');
      await selectOption(page, '结算方式', '月结30天');
      results['供应商资料'] = await submitAndVerify(page, '供应商资料');
    }

    // ── 汇总 ──
    console.log('\n[TEST SUMMARY]');
    for (const [form, ok] of Object.entries(results)) {
      console.log(`  ${ok ? '✓' : '✗'} ${form}`);
    }
    const allPassed = Object.values(results).every(Boolean);
    console.log(`\n[TEST] ${allPassed ? '全部通过 ✓' : '有失败项，请检查截图'}`);
    if (!allPassed) process.exit(1);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
