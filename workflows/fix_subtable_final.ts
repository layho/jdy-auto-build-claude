/**
 * 最终修复关联子表：
 * 1. 删除订单管理上损坏的订单明细字段
 * 2. 删除孤立的订单明细表
 * 3. 用"从空白新建"重新创建，保留反向关联字段
 * 4. 添加必要字段（产品名称/数量/单价/金额）
 * 5. 不删除反向关联字段！
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
  console.log('[FIX SUBTABLE FINAL]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // ====== 1. 删除孤立的订单明细表 ======
    console.log('====== 1. 清理 ======');
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    if (await detailEntry.count() > 0) {
      await detailEntry.hover({ force: true });
      await page.waitForTimeout(600);
      await detailEntry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);
      await page.locator('li:has-text("删除")').last().click({ force: true });
      await page.waitForTimeout(1500);

      const deleteConfirmBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
      if (await deleteConfirmBtn.count() > 0 && await deleteConfirmBtn.isVisible().catch(() => false)) {
        await page.waitForTimeout(3000); // 3秒倒计时
        await deleteConfirmBtn.click({ force: true });
        console.log('✓ 已删除订单明细表');
        await page.waitForTimeout(2000);
      }
    }

    // 刷新
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // ====== 2. 进入订单管理编辑器，删除损坏字段 ======
    console.log('\n====== 2. 清理订单管理 ======');
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

    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log('删除损坏的订单明细字段...');
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(600);
      const deleteBtn = subField.locator('.btn-delete.btn-trash').first();
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(800);
        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
        if (await confirmBtn.count() > 0) await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
      console.log('✓ 已删除');
    }

    await page.locator('button:has-text("保存")').first().click({ force: true });
    await page.waitForTimeout(1500);
    await waitForStableDOM(page);

    // ====== 3. 重新创建关联子表 ======
    console.log('\n====== 3. 从空白新建关联子表 ======');
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    // 选"从空白新建"
    const blankOption = page.getByText('从空白新建').first();
    if (await blankOption.count() > 0 && await blankOption.isVisible().catch(() => false)) {
      await blankOption.click({ force: true });
      console.log('✓ 已选择从空白新建');
      await page.waitForTimeout(1000);
    }

    // 填表单名
    const formNameInput = page.locator('.fx-relatedform-create-path input.input-inner').first();
    if (await formNameInput.count() > 0) {
      await formNameInput.click({ clickCount: 3, force: true });
      await formNameInput.fill('订单明细表');
      console.log('✓ 表单名: 订单明细表');
      await page.waitForTimeout(300);
    }

    // 点击确定（不是设计关联表，先创建表单再编辑）
    const confirmBtn = page.locator('.fx-relatedform-create-path button:has-text("确定")').first();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('✓ 已点击确定（创建关联表）');
      await page.waitForTimeout(3000);
    }

    // ====== 4. 保存主表单 ======
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 主表单已保存');
    await page.waitForTimeout(2000);

    // ====== 5. 编辑订单明细表，添加业务字段 ======
    console.log('\n====== 5. 添加订单明细表字段 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const detailEntry2 = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    await detailEntry2.hover({ force: true });
    await page.waitForTimeout(600);
    await detailEntry2.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let detailFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`订单明细表当前字段: ${detailFields.join(' | ')}`);

    // 需要的业务字段（不删除已有的关联字段！）
    const neededFields = [
      { name: '产品名称', widget: '单行文本' },
      { name: '数量', widget: '数字' },
      { name: '单价', widget: '数字' },
      { name: '金额', widget: '数字' },
    ];

    for (const field of neededFields) {
      if (!detailFields.includes(field.name)) {
        const widget = page.locator('li.form-edit-widget-label').filter({ hasText: field.widget }).first();
        await widget.click({ force: true });
        await page.waitForTimeout(800);

        const fieldTitleInput = page.locator('.fx-field-title-input input.input-inner').last();
        await fieldTitleInput.click({ clickCount: 3, force: true }).catch(() => {});
        await fieldTitleInput.fill(field.name);
        await page.waitForTimeout(400);
        console.log(`  ✓ 已添加: ${field.name}`);
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 订单明细表已保存');
    await page.waitForTimeout(2000);

    detailFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`订单明细表最终字段: ${detailFields.join(' | ')}`);

    // ====== 6. 验证 ======
    console.log('\n====== 6. 最终验证 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const orderEntry2 = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry2.hover({ force: true });
    await page.waitForTimeout(600);
    await orderEntry2.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const orderFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`订单管理字段: ${orderFields.join(' | ')}`);

    if (orderFields.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      const text = await readPage(page);

      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确' : '✗ 有问题'}`);

      const showIdx = text.indexOf('显示字段');
      if (showIdx >= 0) {
        console.log(`显示字段:\n${text.substring(showIdx, showIdx + 200)}`);
      }
    }

    // 检查录入页
    console.log('\n====== 7. 检查录入页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const text = await readPage(page);
    const hasSubTable = text.includes('订单明细');
    console.log(`录入页显示订单明细: ${hasSubTable ? '✓' : '✗'}`);
    console.log(`录入页内容:\n${text.substring(0, 1000)}`);

    await page.screenshot({ path: 'screenshots/subtable-final-fix.png', fullPage: true });

    const allFormNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n表单列表: ${allFormNames.join(' | ')}`);

    console.log('\n====== 修复完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
