/**
 * 检查并修复：
 * 1. 订单管理中数据为空的问题
 * 2. 订单明细表中"未命名表单"字段
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
  console.log('[CHECK & FIX]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    // ====== 1. 检查订单管理数据 ======
    console.log('====== 1. 检查订单管理数据 ======');
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`订单管理页面:\n${text.substring(0, 800)}`);

    // 检查是否显示数据还是空表单
    const hasData = text.includes('ORD-') || text.includes('13800138000');
    console.log(`\n有数据: ${hasData}`);

    // 如果页面显示的是表单录入页（有"提交"按钮），说明之前的数据可能没保存成功
    // 或者是数据列表页（有表格）

    if (text.includes('提交') && text.includes('关联客户')) {
      console.log('当前在数据录入页，尝试提交一条完整订单');

      // 填订单编号
      const inputs = page.locator('input.input-inner:not([readonly])');
      const cnt = await inputs.count();
      console.log(`输入框: ${cnt}个`);

      if (cnt >= 1) {
        await inputs.nth(0).click({ clickCount: 3, force: true });
        await inputs.nth(0).fill('ORD-20260522-001');
      }

      // 点击关联数据
      console.log('\n选择关联客户...');
      const assocBtn = page.locator('button:has-text("关联数据")').first();
      if (await assocBtn.count() > 0) {
        await assocBtn.click({ force: true });
        await page.waitForTimeout(3000);

        text = await readPage(page);
        console.log(`关联弹窗内容:\n${text}`);

        // 找到数据行 - 包含"张三"或电话号码的行
        // 弹窗中应该有一个选择数据的表格
        const dataRow = page.locator('[class*="table-body"] [class*="row"], tr:has-text("13800138000")').first();
        if (await dataRow.count() > 0) {
          console.log('找到数据行');
          await dataRow.click({ force: true });
          await page.waitForTimeout(500);
        } else {
          // 尝试点击包含 13800138000 的行
          const phoneRow = page.locator('text=13800138000').first();
          if (await phoneRow.count() > 0) {
            await phoneRow.click({ force: true });
            await page.waitForTimeout(500);
          }
          console.log('尝试点击电话号码行');
        }

        // 确认选择
        const confirmBtn = page.locator('button:has-text("确定")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          console.log('已确认关联客户');
          await page.waitForTimeout(1500);
        } else {
          // 可能需要点击其他地方关闭
          await page.keyboard.press('Escape');
        }
      }

      // 点击选择数据
      console.log('\n选择产品...');
      await page.waitForTimeout(1000);
      const chooseBtn = page.locator('button:has-text("选择数据")').first();
      if (await chooseBtn.count() > 0) {
        await chooseBtn.click({ force: true });
        await page.waitForTimeout(3000);

        text = await readPage(page);
        console.log(`选择数据弹窗内容:\n${text}`);

        // 找到产品数据行
        const prodRow = page.locator('[class*="table-body"] [class*="row"], tr:has-text("智能手机")').first();
        if (await prodRow.count() > 0) {
          await prodRow.click({ force: true });
          await page.waitForTimeout(500);
        } else {
          const phoneRow = page.locator('text=智能手机').first();
          if (await phoneRow.count() > 0) {
            await phoneRow.click({ force: true });
            await page.waitForTimeout(500);
          }
        }

        const confirmBtn = page.locator('button:has-text("确定")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          console.log('已确认选择产品');
          await page.waitForTimeout(1500);
        }
      }

      // 填写下单日期
      const dateInput = page.locator('input[placeholder*="日期"], [class*="date"] input').first();
      if (await dateInput.count() > 0) {
        await dateInput.click({ force: true });
        await dateInput.fill('2026-05-22');
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: 'screenshots/order-before-submit.png', fullPage: true });

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
      console.log(`提交后:\n${text.substring(0, 500)}`);
    }

    // ====== 2. 检查并修复订单明细表字段 ======
    console.log('\n====== 2. 修复订单明细表字段 ======');
    await goHome(page);

    // 进入订单明细表编辑器
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    await detailEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await detailEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    text = await readPage(page);
    console.log(`订单明细表编辑器:\n${text.substring(0, 1000)}`);

    // 列出所有字段
    const fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        return label;
      })
    );
    console.log(`\n画布字段: ${fields.join(' | ')}`);

    // 删除"未命名表单"字段
    for (let i = fields.length - 1; i >= 0; i--) {
      if (fields[i] === '未命名表单' || fields[i].includes('未命名')) {
        console.log(`\n删除字段[${i}]: "${fields[i]}"`);
        const fieldEl = page.locator('.fx-field-layout.field').nth(i);

        // 点击选中
        await fieldEl.click({ force: true });
        await page.waitForTimeout(600);

        // 点删除按钮
        const deleteBtn = fieldEl.locator('.btn-delete.btn-trash, i[title="删除"]').first();
        if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
          await deleteBtn.click({ force: true });
          console.log('✓ 已删除');
          await page.waitForTimeout(1000);
        } else {
          console.log('删除按钮不可见，尝试force');
          await deleteBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
        }

        // 确认弹窗
        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定"), [class*="alert"] button:has-text("删除")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          console.log('✓ 已确认');
          await page.waitForTimeout(1000);
        }
      }
    }

    // 保存
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click({ force: true });
      console.log('✓ 已保存');
      await page.waitForTimeout(2000);
    }

    // 重新列出确认
    const fieldsAfter = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        return label;
      })
    );
    console.log(`\n修复后字段: ${fieldsAfter.join(' | ')}`);

    // ====== 3. 回到订单管理查看数据 ======
    console.log('\n====== 3. 查看订单管理数据 ======');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`订单管理当前:\n${text.substring(0, 600)}`);

    await page.screenshot({ path: 'screenshots/final-check.png', fullPage: true });

    console.log('\n====== 全部完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
