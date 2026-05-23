/**
 * 修复剩余问题：
 * 1. 验证关联客户→客户信息
 * 2. 配置选择产品→产品信息
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function readPage(page: Page): Promise<string> {
  return await page.locator('body').first().innerText().catch(() => '') || '';
}

async function saveForm(page: Page): Promise<void> {
  await page.locator('button:has-text("保存")').first().click({ force: true });
  console.log('  ✓ 已保存');
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
}

async function main() {
  console.log('[FIX REMAINING] 修复剩余配置\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const formEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await formEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await formEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let text = await readPage(page);

    // ====== 1. 验证关联客户 ======
    console.log('====== 1. 验证关联客户→客户信息 ======');
    const assocField = page.locator('.fx-field-layout.field').filter({ hasText: '关联客户' }).first();
    await assocField.click({ force: true });
    await page.waitForTimeout(1500);

    text = await readPage(page);
    // 在属性面板中查找关联信息
    const assocIdx = text.indexOf('选择主表');
    if (assocIdx >= 0) {
      console.log(`属性面板:\n  ${text.substring(assocIdx, assocIdx + 300).replace(/\n/g, '\n  ')}`);
    }

    // 检查当前选中的主表
    const linkDropdown = page.locator('.link-form-combo .x-biz-dropdown-label').first();
    const linkText = await linkDropdown.innerText().catch(() => '');
    console.log(`当前主表: "${linkText}"`);

    if (!linkText.includes('客户信息')) {
      console.log('需要重新选择客户信息...');
      await linkDropdown.click({ force: true });
      await page.waitForTimeout(1000);

      text = await readPage(page);
      console.log(`下拉内容片段:\n  ${text.substring(0, 1500).replace(/\n/g, '\n  ')}`);

      // 找客户信息选项
      const opt = page.locator('[class*="option"]:has-text("客户信息"), li:has-text("客户信息")').first();
      if (await opt.count() > 0 && await opt.isVisible().catch(() => false)) {
        await opt.click({ force: true });
        console.log('  ✓ 已选择客户信息');
      } else {
        await page.locator('text=客户信息').first().click({ force: true }).catch(() => {});
        console.log('  尝试文本点击...');
      }
      await page.waitForTimeout(500);
    } else {
      console.log('  ✓ 关联客户已正确链接到客户信息');
    }

    await saveForm(page);

    // ====== 2. 配置选择产品→产品信息 ======
    console.log('\n====== 2. 配置选择产品→产品信息 ======');

    const chooseField = page.locator('.fx-field-layout.field').filter({ hasText: '选择产品' }).first();
    await chooseField.click({ force: true });
    await page.waitForTimeout(1500);

    text = await readPage(page);
    console.log(`选择数据属性面板内容:\n${text.substring(text.indexOf('标题'), text.indexOf('标题') + 600).replace(/\n/g, '\n')}`);

    // 查找数据源区域
    const dsIdx = text.indexOf('数据源');
    if (dsIdx >= 0) {
      console.log(`\n数据源区域:\n  ${text.substring(dsIdx, dsIdx + 300).replace(/\n/g, '\n  ')}`);
    }

    // 找所有可见的 x-biz-dropdown-label
    const allDDs = page.locator('.x-biz-dropdown-label');
    const ddCount = await allDDs.count();
    console.log(`\n可见dropdown: ${ddCount}个`);

    for (let i = 0; i < ddCount; i++) {
      const dd = allDDs.nth(i);
      const ddVisible = await dd.isVisible().catch(() => false);
      const ddText = await dd.innerText().catch(() => '');
      if (ddVisible) {
        console.log(`  [${i}] "${ddText}"`);
      }
    }

    // 点开数据源下拉 - 找空文本的下拉
    let clicked = false;
    for (let i = 0; i < ddCount; i++) {
      const dd = allDDs.nth(i);
      const ddText = await dd.innerText().catch(() => '');
      const ddVisible = await dd.isVisible().catch(() => false);
      if (!ddText.trim() && ddVisible) {
        await dd.click({ force: true });
        console.log(`  点击dropdown[${i}]`);
        await page.waitForTimeout(1500);
        clicked = true;
        break;
      }
    }

    if (clicked) {
      // 截图看看下拉菜单
      await page.screenshot({ path: 'screenshots/fix-dropdown-open.png', fullPage: true });

      text = await readPage(page);
      console.log(`\n下拉展开后页面:\n${text.substring(0, 2000).replace(/\n/g, '\n')}`);

      // 找所有option
      const allOptions = page.locator('[class*="option"], [class*="menu-item"], [class*="select-item"], li');
      const optCount = await allOptions.count();
      console.log(`\n  option类元素: ${optCount}个`);

      for (let i = 0; i < Math.min(optCount, 30); i++) {
        const opt = allOptions.nth(i);
        const optVisible = await opt.isVisible().catch(() => false);
        const optText = await opt.innerText().catch(() => '');
        if (optVisible && optText.trim()) {
          console.log(`  [${i}] "${optText.substring(0, 50)}"`);
        }
      }

      // 尝试点击产品信息
      const productOpts = [
        page.locator('[class*="option"]:has-text("产品信息")').first(),
        page.locator('li:has-text("产品信息")').first(),
        page.locator('[class*="item"]:has-text("产品信息")').first(),
        page.locator('text=产品信息').last(),
      ];

      for (const po of productOpts) {
        if (await po.count() > 0 && await po.isVisible().catch(() => false)) {
          await po.click({ force: true });
          console.log('  ✓ 已选择产品信息');
          await page.waitForTimeout(500);
          clicked = false;
          break;
        }
      }

      if (clicked) {
        console.log('  ⚠ 所有选择器都未找到产品信息');
      }
    } else {
      console.log('  ⚠ 没有空dropdown可以点击');
    }

    await saveForm(page);

    // ====== 截图 ======
    await page.screenshot({ path: 'screenshots/fix-remaining-done.png', fullPage: true });

    // ====== 最终验证 ======
    text = await readPage(page);
    console.log('\n====== 最终验证 ======');
    const checks = ['订单编号', '下单日期', '关联客户', '客户信息', '订单明细', '选择产品', '产品信息'];
    checks.forEach(kw => console.log(`  ${text.includes(kw) ? '✓' : '✗'} ${kw}`));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
