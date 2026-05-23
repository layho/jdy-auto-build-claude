/**
 * 验证关联子表功能：
 * 1. 检查订单管理中关联子表的配置
 * 2. 提交一条包含子表数据的订单
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

async function goHome(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2500);
}

async function main() {
  console.log('[TEST SUBTABLE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    // ====== 1. 检查关联子表配置 ======
    console.log('====== 1. 检查关联子表配置 ======');

    // 进入订单管理编辑器
    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let text = await readPage(page);
    console.log(`编辑器内容:\n${text.substring(0, 1000)}`);

    // 列出所有字段
    const fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        return label;
      })
    );
    console.log(`\n画布字段: ${fields.join(' | ')}`);

    // 点击"订单明细"字段查看属性
    const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await subField.count() > 0) {
      console.log('\n点击订单明细字段...');
      await subField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      console.log(`属性面板:\n${text.substring(text.indexOf('标题'), text.indexOf('标题') + 600)}`);

      // 检查关联表
      if (text.includes('订单明细表')) {
        console.log('✓ 关联子表已绑定订单明细表');
      } else {
        console.log('✗ 关联子表未绑定订单明细表！');
        // 需要配置
        const tblDropdown = page.locator('.x-biz-dropdown-label').first();
        if (await tblDropdown.count() > 0) {
          const tblText = await tblDropdown.innerText().catch(() => '');
          console.log(`当前关联表: "${tblText}"`);
        }
      }
    }

    // 保存并退出编辑器
    await page.locator('button:has-text("保存")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);

    // ====== 2. 提交带子表数据的订单 ======
    console.log('\n====== 2. 提交带子表的订单 ======');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`订单录入页:\n${text}`);

    // 填写订单编号 - 跳过搜索框
    const allInputs = page.locator('input.input-inner:not([readonly])');
    const allCount = await allInputs.count();
    const formInputs: any[] = [];
    for (let i = 0; i < allCount; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) {
        formInputs.push(inp);
      }
    }

    if (formInputs.length >= 1) {
      await formInputs[0].fill('ORD-20260522-002');
      console.log('✓ 订单编号已填写');
    }

    // 选择关联客户
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) {
      await assocBtn.click({ force: true });
      await page.waitForTimeout(3000);

      const customerRow = page.locator('[class*="table-body"] [class*="row"]:has-text("张三"), tr:has-text("张三")').first();
      if (await customerRow.count() > 0) {
        const cb = customerRow.locator('input[type="checkbox"], input[type="radio"]').first();
        if (await cb.count() > 0) {
          await cb.click({ force: true });
        } else {
          await customerRow.click({ force: true });
        }
      }

      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1500);
      }
    }

    // 选择产品
    const chooseBtn = page.locator('button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0) {
      await chooseBtn.click({ force: true });
      await page.waitForTimeout(3000);

      const productRow = page.locator('[class*="table-body"] [class*="row"]:has-text("智能手机"), tr:has-text("智能手机")').first();
      if (await productRow.count() > 0) {
        const cb = productRow.locator('input[type="checkbox"], input[type="radio"]').first();
        if (await cb.count() > 0) {
          await cb.click({ force: true });
        } else {
          await productRow.click({ force: true });
        }
      }

      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1500);
      }
    }

    // ====== 关键：填写子表数据 ======
    console.log('\n====== 填写关联子表 ======');
    text = await readPage(page);
    console.log(`当前页面:\n${text.substring(0, 800)}`);

    // 找子表中的"添加"按钮
    const subAddBtn = page.locator('[class*="link-table"] button:has-text("添加"), button:has-text("添加"):below(:has-text("订单明细"))').first();
    if (await subAddBtn.count() > 0 && await subAddBtn.isVisible().catch(() => false)) {
      console.log('找到子表添加按钮，点击...');
      await subAddBtn.click({ force: true });
      await page.waitForTimeout(2000);

      text = await readPage(page);
      console.log(`子表添加后:\n${text.substring(0, 1000)}`);

      // 在子表中找输入框
      const subInputs = page.locator('[class*="link-table"] input.input-inner:not([readonly])');
      const siCount = await subInputs.count();
      console.log(`子表输入框: ${siCount}个`);

      for (let i = 0; i < Math.min(siCount, 6); i++) {
        const inp = subInputs.nth(i);
        const val = await inp.inputValue().catch(() => '');
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        console.log(`  [${i}] value="${val}" placeholder="${ph}"`);
      }

      // 填写子表数据
      if (siCount >= 1) await subInputs.nth(0).fill('智能手机');
      if (siCount >= 2) await subInputs.nth(1).fill('2');
      if (siCount >= 3) await subInputs.nth(2).fill('2999');
      if (siCount >= 4) await subInputs.nth(3).fill('5998');
      console.log('✓ 子表数据已填写');

      // 确认子表行
      const subConfirm = page.locator('[class*="link-table"] button:has-text("确定"), [class*="link-table"] button:has-text("保存")').first();
      if (await subConfirm.count() > 0 && await subConfirm.isVisible().catch(() => false)) {
        await subConfirm.click({ force: true });
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('未找到子表添加按钮');
      // 搜索所有"添加"按钮
      const allAddBtns = page.locator('button:has-text("添加"), text=添加');
      const addCount = await allAddBtns.count();
      console.log(`页面中"添加"相关元素: ${addCount}个`);
      for (let i = 0; i < Math.min(addCount, 10); i++) {
        const btn = allAddBtns.nth(i);
        const btnText = await btn.innerText().catch(() => '');
        const btnVisible = await btn.isVisible().catch(() => false);
        const parentText = await btn.locator('..').locator('..').innerText().catch(() => '').then(t => t.substring(0, 60));
        console.log(`  [${i}] text="${btnText}" visible=${btnVisible} parent="${parentText}"`);
      }
    }

    await page.screenshot({ path: 'screenshots/subtable-filled.png', fullPage: true });

    // 提交
    text = await readPage(page);
    console.log(`\n提交前页面:\n${text.substring(0, 800)}`);

    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 订单已提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`\n提交后:\n${text.substring(0, 300)}`);

    // ====== 3. 验证子表数据 ======
    console.log('\n====== 3. 验证数据 ======');

    // 切换到管理视图看数据
    const dataMgmtBtn = page.locator('button:has-text("数据管理")').first();
    if (await dataMgmtBtn.count() > 0) {
      await dataMgmtBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    text = await readPage(page);
    console.log(`数据管理:\n${text.substring(0, 1000)}`);

    // 点击数据行查看详情（可能需要点进具体记录看子表）
    const dataRow = page.locator('[class*="table-body"] [class*="row"]:has-text("ORD-"), tr:has-text("ORD-")').first();
    if (await dataRow.count() > 0) {
      await dataRow.click({ force: true });
      await page.waitForTimeout(2000);
      text = await readPage(page);
      console.log(`数据详情:\n${text.substring(0, 1000)}`);
    }

    await page.screenshot({ path: 'screenshots/subtable-result.png', fullPage: true });
    console.log('\n====== 子表测试完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
