/**
 * 修复关联子表 V8：
 * 核心策略：
 * 1. 删除孤立的订单明细表（它已无法被"绑定已有表单"选中）
 * 2. 从订单管理删除损坏的订单明细字段
 * 3. 用"从空白新建"重新创建订单明细表 → 设计字段 → 保存
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
  console.log('[FIX SUBTABLE V8]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // ====== 1. 删除孤立的订单明细表 ======
    console.log('====== 1. 删除孤立的订单明细表 ======');
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();

    if (await detailEntry.count() > 0) {
      await detailEntry.hover({ force: true });
      await page.waitForTimeout(600);
      await detailEntry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);
      await page.locator('li:has-text("删除")').last().click({ force: true });
      await page.waitForTimeout(1500);

      // 处理确认弹窗
      let text = await readPage(page);
      console.log(`删除确认:\n${text.substring(0, 500)}`);

      // 可能有"确定要删除"弹窗，需要点击"删除"按钮
      const deleteConfirmBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
      if (await deleteConfirmBtn.count() > 0 && await deleteConfirmBtn.isVisible().catch(() => false)) {
        await page.waitForTimeout(3000); // 简道云删除有3秒倒计时
        await deleteConfirmBtn.click({ force: true });
        console.log('✓ 已确认删除订单明细表');
        await page.waitForTimeout(2000);
      } else {
        // 可能因为被引用而不能删除
        const knowBtn = page.locator('button:has-text("我知道了")').last();
        if (await knowBtn.count() > 0 && await knowBtn.isVisible().catch(() => false)) {
          await knowBtn.click({ force: true });
          console.log('⚠ 无法删除 - 可能仍被引用');
        }
      }
    }

    // 刷新页面
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`当前表单: ${formNames.join(' | ')}`);

    // ====== 2. 进入订单管理编辑器，删除损坏字段 ======
    console.log('\n====== 2. 清理订单管理的字段 ======');
    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    // 删除订单明细字段
    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log('删除订单明细字段...');
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(600);
      const deleteBtn = subField.locator('.btn-delete.btn-trash').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(800);
        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
        if (await confirmBtn.count() > 0) await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(1500);
    await waitForStableDOM(page);

    // ====== 3. 用"从空白新建"创建关联子表 ======
    console.log('\n====== 3. 从空白新建关联子表 ======');
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 设标题
    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    // 选择"从空白新建"
    const blankOption = page.getByText('从空白新建').first();
    if (await blankOption.count() > 0 && await blankOption.isVisible().catch(() => false)) {
      await blankOption.click({ force: true });
      console.log('✓ 已选择从空白新建');
      await page.waitForTimeout(1000);
    }

    let text = await readPage(page);
    console.log(`\n从空白新建后dialog:\n${text.substring(text.indexOf('添加关联子表'), text.indexOf('添加关联子表') + 500)}`);

    // 查找表单名称输入框
    const formNameInputs = page.locator('.fx-relatedform-create-path input.input-inner');
    const fniCount = await formNameInputs.count();
    console.log(`dialog中的输入框: ${fniCount}个`);

    for (let i = 0; i < fniCount; i++) {
      const inp = formNameInputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      console.log(`  [${i}] value="${val}" placeholder="${ph}"`);
    }

    // 填表单名
    if (fniCount >= 1) {
      const nameInput = formNameInputs.nth(0);
      await nameInput.click({ clickCount: 3, force: true });
      await nameInput.fill('订单明细表');
      console.log('✓ 表单名: 订单明细表');
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: 'screenshots/subtable-v8-create-blank.png', fullPage: true });

    // 点击"设计关联表"按钮
    const designBtn = page.locator('button:has-text("设计关联表")').first();
    if (await designBtn.count() > 0 && await designBtn.isVisible().catch(() => false)) {
      await designBtn.click({ force: true });
      console.log('✓ 已点击设计关联表');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    } else {
      // 可能直接点确定
      const confirmBtn = page.locator('.fx-relatedform-create-path button:has-text("确定")').first();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        console.log('✓ 已点击确定');
        await page.waitForTimeout(3000);
      }
    }

    // ====== 4. 设计关联表字段 ======
    text = await readPage(page);
    console.log(`\n设计关联表页面:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/subtable-v8-design.png', fullPage: true });

    // 检查是否进入了子表编辑器（可能有嵌套的字段编辑器）
    // 查找画布上的字段
    let subFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`关联表当前字段: ${subFields.join(' | ')}`);

    // 如果需要添加字段，这里添加 产品名称, 数量, 单价, 金额
    const neededFields = ['产品名称', '数量', '单价', '金额'];
    const widgetTypes = ['单行文本', '数字', '数字', '数字'];

    // 检查是否在子表编辑器中（可能有嵌套的field布局）
    // 如果字段不够，逐个添加
    if (subFields.length < 4) {
      console.log('\n添加字段到关联表...');
      for (let i = 0; i < neededFields.length; i++) {
        if (!subFields.includes(neededFields[i])) {
          // 点击widget
          const widget = page.locator(`li.form-edit-widget-label:has-text("${widgetTypes[i]}")`).first();
          if (await widget.count() > 0) {
            await widget.click({ force: true });
            await page.waitForTimeout(800);

            // 设置字段名
            const fieldTitleInput = page.locator('.fx-field-title-input input.input-inner').last();
            await fieldTitleInput.click({ clickCount: 3, force: true }).catch(() => {});
            await fieldTitleInput.fill(neededFields[i]);
            await page.waitForTimeout(300);
            console.log(`  ✓ 已添加: ${neededFields[i]}`);
          }
        }
      }
    }

    // 检查是否有返回按钮或者保存按钮
    await page.screenshot({ path: 'screenshots/subtable-v8-fields-added.png', fullPage: true });

    // 保存主编辑器
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.count() > 0 && await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      console.log('✓ 已保存');
      await page.waitForTimeout(2000);
    }

    // ====== 5. 验证 ======
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`\n最终字段: ${fields.join(' | ')}`);

    if (fields.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);

      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确绑定到订单明细表' : '✗ 可能未成功'}`);
      if (!ok) {
        const assocIdx = text.indexOf('关联表');
        if (assocIdx >= 0) {
          console.log(`属性面板:\n${text.substring(assocIdx, assocIdx + 400)}`);
        }
      }
    }

    // 检查表单列表
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    const finalFormNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n最终表单: ${finalFormNames.join(' | ')}`);

    await page.screenshot({ path: 'screenshots/subtable-v8-final.png', fullPage: true });
    console.log('\n====== V8 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
