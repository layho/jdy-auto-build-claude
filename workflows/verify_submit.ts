/**
 * 最终验证：检查关联子表绑定，提交带子表数据的订单
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
  console.log('[VERIFY & SUBMIT]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 检查关联子表绑定 ======
    console.log('====== 1. 检查关联子表绑定 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 点订单明细字段
    const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    await subField.click({ force: true });
    await page.waitForTimeout(1500);

    let text = await readPage(page);
    console.log(`属性面板关键部分:\n${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 300)}`);

    const isLinked = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('没有可选择的');
    console.log(`\n关联子表绑定状态: ${isLinked ? '✓ 正确' : '✗ 有问题'}`);

    if (!isLinked) {
      console.log('需要修复 - 尝试在属性面板中直接选');

      // 在属性面板中找"关联表"下拉
      const assocTableDD = page.locator('.x-biz-dropdown-label').first();
      if (await assocTableDD.count() > 0) {
        const currentVal = await assocTableDD.innerText().catch(() => '');
        console.log(`当前关联表: "${currentVal}"`);

        // 如果需要修复，点开下拉选订单明细表
        if (!currentVal.includes('订单明细表')) {
          await assocTableDD.click({ force: true });
          await page.waitForTimeout(1500);

          text = await readPage(page);
          console.log(`下拉选项:\n${text.substring(0, 1200)}`);

          const detailOpt = page.locator('[class*="option"]:has-text("订单明细表")').first();
          if (await detailOpt.count() > 0 && await detailOpt.isVisible().catch(() => false)) {
            await detailOpt.click({ force: true });
            console.log('✓ 已选择订单明细表');
            await page.waitForTimeout(500);
          }
        }
      }

      await page.locator('button:has-text("保存")').first().click({ force: true });
      await page.waitForTimeout(2000);
    }

    // ====== 2. 提交带子表的订单 ======
    console.log('\n====== 2. 提交带子表的订单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`录入页:\n${text}`);

    // 过滤搜索框，填订单编号
    const allInputs = page.locator('input.input-inner:not([readonly])');
    const ac = await allInputs.count();
    const formInputs: any[] = [];
    for (let i = 0; i < ac; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) formInputs.push(inp);
    }
    if (formInputs.length >= 1) await formInputs[0].fill('ORD-20260522-004');
    console.log('✓ 订单编号已填写');

    // 关联客户
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) {
      await assocBtn.click({ force: true });
      await page.waitForTimeout(2500);
      await page.locator('[class*="table-body"] [class*="row"]:has-text("张三")').first().click({ force: true }).catch(() => {});
      const cb = page.locator('input[type="checkbox"]').first();
      if (await cb.count() > 0) await cb.click({ force: true });
      await page.locator('button:has-text("确定")').last().click({ force: true });
      await page.waitForTimeout(1000);
      console.log('✓ 已关联客户');
    }

    // 选择产品
    const chooseBtn = page.locator('button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0) {
      await chooseBtn.click({ force: true });
      await page.waitForTimeout(2500);
      await page.locator('[class*="table-body"] [class*="row"]:has-text("智能手机")').first().click({ force: true }).catch(() => {});
      const cb = page.locator('input[type="checkbox"]').first();
      if (await cb.count() > 0) await cb.click({ force: true });
      await page.locator('button:has-text("确定")').last().click({ force: true });
      await page.waitForTimeout(1000);
      console.log('✓ 已选择产品');
    }

    // ====== 找子表添加按钮 ======
    text = await readPage(page);
    console.log(`\n当前表单:\n${text}`);

    // 搜索子表相关的"添加"
    const allAddElements = await page.$$eval('*', els =>
      els.filter(el => {
        const txt = (el.textContent || '').trim();
        return txt === '添加' && (el as HTMLElement).offsetHeight > 0;
      }).map(el => ({
        tag: el.tagName,
        class: ((el as HTMLElement).className || '').substring(0, 100),
      }))
    );
    console.log(`\n"添加"元素: ${allAddElements.length}个`);
    allAddElements.forEach((e, i) => console.log(`  [${i}] ${e.tag} class="${e.class}"`));

    // 方法1：找link-table中的添加
    const linkTableAdd = page.locator('.link-table-head:has-text("添加"), [class*="link-table"] button:has-text("添加")').first();
    if (await linkTableAdd.count() > 0 && await linkTableAdd.isVisible().catch(() => false)) {
      console.log('\n找到子表添加按钮，点击...');
      await linkTableAdd.click({ force: true });
      await page.waitForTimeout(2000);

      text = await readPage(page);
      console.log(`子表行编辑:\n${text.substring(0, 800)}`);

      // 填子表字段
      const subInputs = page.locator('[class*="link-table"] input.input-inner:not([readonly])');
      const siCount = await subInputs.count();
      console.log(`子表输入框: ${siCount}个`);
      if (siCount >= 1) await subInputs.nth(0).fill('智能手机');
      if (siCount >= 2) await subInputs.nth(1).fill('2');
      if (siCount >= 3) await subInputs.nth(2).fill('2999');
      if (siCount >= 4) await subInputs.nth(3).fill('5998');

      console.log('✓ 子表数据已填写');
      await page.screenshot({ path: 'screenshots/subtable-row.png', fullPage: true });
    } else {
      console.log('未找到子表添加按钮');
    }

    // 提交
    text = await readPage(page);
    console.log(`\n提交前:\n${text.substring(0, 800)}`);

    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`\n提交结果: ${text.includes('提交成功') ? '✓ 成功' : '✗ 失败'}`);
    console.log(text.substring(0, 300));

    console.log('\n====== 验证完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
