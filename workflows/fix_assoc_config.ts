/**
 * 修复订单管理表单的关联字段配置：
 * 1. 关联数据 → 选择主表(客户信息)
 * 2. 选择数据 → 选择数据源(产品信息)
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

async function main() {
  console.log('[FIX] 修复关联字段配置\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入编辑器
    console.log('进入订单管理编辑器...');
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
    console.log(`页面字段:\n${text.substring(text.indexOf('字段回收站'), text.indexOf('字段属性')).replace(/\n/g, '\n')}`);

    // ====== 1. 修复关联数据：选择主表 ======
    console.log('\n====== 1. 修复关联数据：选择客户信息为主表 ======');

    // 点击画布上的"关联客户"字段
    const linkField = page.locator('.fx-field-layout.field').filter({ hasText: '关联客户' }).first();
    if (await linkField.count() > 0) {
      console.log('  点击"关联客户"字段...');
      await linkField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      // 检查属性面板是否显示关联数据设置
      const propStart = text.indexOf('选择主表');
      if (propStart >= 0) {
        console.log(`  属性面板:\n    ${text.substring(propStart, propStart + 200).replace(/\n/g, '\n    ')}`);
      }

      // 点击选择主表下拉
      const dropdown = page.locator('.link-form-combo .x-biz-dropdown-label').first();
      const ddCount = await dropdown.count();
      console.log(`  link-form-combo dropdown count: ${ddCount}`);

      if (ddCount > 0) {
        await dropdown.click({ force: true });
        await page.waitForTimeout(1000);

        text = await readPage(page);
        console.log(`  下拉内容:\n    ${text.substring(0, 1000).replace(/\n/g, '\n    ')}`);

        // 选"客户信息"
        const customerOpt = page.locator('[class*="option-item"]:has-text("客户信息"), [class*="option"]:has-text("客户信息"), li:has-text("客户信息")').first();
        console.log(`  客户信息选项 count: ${await customerOpt.count()}`);

        if (await customerOpt.count() > 0) {
          await customerOpt.click({ force: true });
          console.log('  ✓ 已选择客户信息');
        } else {
          // 试试用文本点击
          await page.locator('text=客户信息').first().click({ force: true }).catch(() => {});
          console.log('  尝试文本点击...');
        }
        await page.waitForTimeout(1000);
      } else {
        console.log('  ⚠ 没有 link-form-combo dropdown');
        // 看看属性面板实际显示了什么
        console.log(`  完整页面:\n${text.substring(0, 2000)}`);
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('  ✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== 2. 修复选择数据：选择数据源 ======
    console.log('\n====== 2. 修复选择数据：选择产品信息为数据源 ======');

    // 点击画布上的"选择产品"字段
    const chooseField = page.locator('.fx-field-layout.field').filter({ hasText: '选择产品' }).first();
    if (await chooseField.count() > 0) {
      console.log('  点击"选择产品"字段...');
      await chooseField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      const dsStart = text.indexOf('数据源');
      if (dsStart >= 0) {
        console.log(`  属性面板:\n    ${text.substring(dsStart, dsStart + 300).replace(/\n/g, '\n    ')}`);
      }

      // 找所有 x-biz-dropdown-label
      const allDropdowns = page.locator('.x-biz-dropdown-label');
      const allCount = await allDropdowns.count();
      console.log(`  页面中所有 x-biz-dropdown-label: ${allCount}`);

      for (let i = 0; i < allCount; i++) {
        const dd = allDropdowns.nth(i);
        const ddText = await dd.innerText().catch(() => '');
        const ddVisible = await dd.isVisible().catch(() => false);
        console.log(`    [${i}] visible=${ddVisible} text="${ddText?.substring(0, 50)}"`);
      }

      // 点击数据源下的下拉（找有placeholder的）
      const placeholderDD = page.locator('.dropdown-label-placeholder').first();
      if (await placeholderDD.count() > 0) {
        // 点它的父级 x-biz-dropdown-label
        const parentDD = placeholderDD.locator('..').locator('..');
        await parentDD.click({ force: true });
        console.log('  点击placeholder的父级dropdown...');
        await page.waitForTimeout(1000);
      } else {
        // 点最后一个可见的 dropdown
        const lastDD = page.locator('.x-biz-dropdown-label').last();
        if (await lastDD.count() > 0 && await lastDD.isVisible().catch(() => false)) {
          await lastDD.click({ force: true });
          console.log('  点击最后一个dropdown...');
          await page.waitForTimeout(1000);
        }
      }

      text = await readPage(page);
      console.log(`  下拉后页面:\n    ${text.substring(0, 1200).replace(/\n/g, '\n    ')}`);

      // 选择"产品信息"
      const productOpt = page.locator('[class*="option"]:has-text("产品信息"), li:has-text("产品信息")').first();
      if (await productOpt.count() > 0 && await productOpt.isVisible().catch(() => false)) {
        await productOpt.click({ force: true });
        console.log('  ✓ 已选择产品信息');
      } else {
        await page.locator('text=产品信息').last().click({ force: true }).catch(() => {});
        console.log('  尝试文本点击产品信息...');
      }
      await page.waitForTimeout(1000);
    }

    // 最终保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('  ✓ 最终保存');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/fixed-final.png', fullPage: true });

    // 验证
    text = await readPage(page);
    console.log('\n====== 验证 ======');
    console.log(`  关联数据: ${text.includes('已和') && text.includes('建立关联') ? '✓ 已配置' : '✗ 未配置'}`);
    console.log(`  客户信息: ${text.includes('客户信息') ? '✓' : '✗'}`);
    console.log(`  产品信息: ${text.includes('产品信息') ? '✓' : '✗'}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
