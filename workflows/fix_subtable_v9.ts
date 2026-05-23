/**
 * 最终修复关联子表 V9：
 * 更健壮的实现，每步都验证
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
  console.log('[FIX SUBTABLE V9]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 删除旧的订单明细表 ======
    console.log('====== 1. 删除旧订单明细表 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const oldDetail = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    if (await oldDetail.count() > 0) {
      await oldDetail.hover({ force: true });
      await page.waitForTimeout(600);
      await oldDetail.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);
      await page.locator('li:has-text("删除")').last().click({ force: true });
      await page.waitForTimeout(1500);
      const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
      if (await delBtn.count() > 0) {
        await page.waitForTimeout(3000);
        await delBtn.click({ force: true });
        console.log('✓ 已删除');
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('没有旧订单明细表');
    }

    // ====== 2. 进入订单管理编辑器 ======
    console.log('\n====== 2. 进入编辑器 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

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

    // ====== 3. 删除损坏的订单明细字段 ======
    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log(`删除损坏的订单明细字段 [${subIdx}]...`);
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
      console.log('✓ 已删除');
    }

    // 先保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
    await page.waitForTimeout(1000);

    // ====== 4. 添加关联子表 ======
    console.log('\n====== 4. 添加关联子表 ======');

    // 确保widget面板可见 - 可能需要滚动widget列表
    const widgetPanel = page.locator('.form-edit-widget-list, [class*="widget-list"], [class*="widget-panel"]').first();
    console.log(`Widget面板: ${await widgetPanel.count()}个`);

    // 滚动到关联子表widget
    const subTableWidget = page.locator('li.form-edit-widget-label:has-text("关联子表")').first();
    const widgetCount = await subTableWidget.count();
    console.log(`关联子表widget: ${widgetCount}个`);

    if (widgetCount > 0) {
      // 先滚动到视图中
      await subTableWidget.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);

      const widgetVisible = await subTableWidget.isVisible().catch(() => false);
      console.log(`widget可见: ${widgetVisible}`);

      await subTableWidget.click({ force: true });
      console.log('✓ 已点击关联子表widget');
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠ 找不到关联子表widget');
    }

    // 检查dialog是否打开
    let text = await readPage(page);
    const dialogOpen = text.includes('添加关联子表');
    console.log(`Dialog打开: ${dialogOpen}`);

    if (!dialogOpen) {
      console.log('Dialog未打开，重试...');
      // 可能widget在子菜单中，需要先展开"关联"分组
      const assocGroup = page.locator('[class*="widget-group"]:has-text("关联"), [class*="widget-category"]:has-text("关联")').first();
      if (await assocGroup.count() > 0) {
        await assocGroup.click({ force: true });
        await page.waitForTimeout(500);
      }
      await subTableWidget.click({ force: true });
      await page.waitForTimeout(2000);
      text = await readPage(page);
      console.log(`Dialog打开(重试后): ${text.includes('添加关联子表')}`);
    }

    if (!text.includes('添加关联子表')) {
      console.log('无法打开关联子表dialog，中止');
      await page.screenshot({ path: 'screenshots/v9-no-dialog.png', fullPage: true });
      return;
    }

    // 设标题
    const titleInputs = page.locator('.fx-field-title-input input.input-inner');
    const tiCount = await titleInputs.count();
    console.log(`标题输入框: ${tiCount}个`);
    if (tiCount > 0) {
      const ti = titleInputs.last();
      await ti.click({ clickCount: 3, force: true }).catch(() => {});
      await page.waitForTimeout(200);
      await ti.fill('订单明细');
      console.log('✓ 标题: 订单明细');
    }

    await page.waitForTimeout(300);

    // 选"从空白新建"
    const blankOption = page.getByText('从空白新建').first();
    const boCount = await blankOption.count();
    console.log(`"从空白新建": ${boCount}个`);
    if (boCount > 0) {
      const boVisible = await blankOption.isVisible().catch(() => false);
      console.log(`  可见: ${boVisible}`);
      if (boVisible) {
        await blankOption.click({ force: true });
        console.log('✓ 已选择从空白新建');
        await page.waitForTimeout(1500);
      }
    }

    text = await readPage(page);
    console.log(`\n选择后dialog:\n${text.substring(text.indexOf('添加关联子表'), text.indexOf('添加关联子表') + 400)}`);

    // 找表单名输入框
    const allDialogInputs = page.locator('.fx-relatedform-create-path input.input-inner');
    const adiCount = await allDialogInputs.count();
    console.log(`\nDialog中input: ${adiCount}个`);
    for (let i = 0; i < adiCount; i++) {
      const inp = allDialogInputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      console.log(`  [${i}] value="${val}" ph="${ph}"`);
    }

    if (adiCount >= 1) {
      const nameInput = allDialogInputs.nth(0);
      await nameInput.click({ clickCount: 3, force: true });
      await nameInput.fill('订单明细表');
      console.log('✓ 表单名: 订单明细表');
      await page.waitForTimeout(300);
    }

    // 点击确定
    const dialogConfirm = page.locator('.fx-relatedform-create-path button:has-text("确定")').first();
    const dcCount = await dialogConfirm.count();
    console.log(`\nDialog确定按钮: ${dcCount}个`);
    if (dcCount > 0) {
      await dialogConfirm.click({ force: true });
      console.log('✓ 已点击确定');
      await page.waitForTimeout(3000);
    }

    // 保存主表单
    text = await readPage(page);
    console.log(`\n保存前状态:\n${text.substring(0, 500)}`);

    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 主表单已保存');
    await page.waitForTimeout(2000);

    // ====== 5. 验证订单明细表已创建 ======
    console.log('\n====== 5. 验证 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`表单: ${formNames.join(' | ')}`);

    if (!formNames.includes('订单明细表')) {
      console.log('⚠ 订单明细表未创建！');
      await page.screenshot({ path: 'screenshots/v9-no-detail-form.png', fullPage: true });
      return;
    }

    // 进入关联子表编辑器添加字段
    console.log('\n====== 6. 添加订单明细表字段 ======');
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    await detailEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await detailEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let detailFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${detailFields.join(' | ')}`);

    // 添加业务字段（注意：保留已有的关联字段）
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
        console.log(`  ✓ ${field.name}`);
      }
    }

    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    detailFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`最终字段: ${detailFields.join(' | ')}`);

    // ====== 7. 验证关联 ======
    console.log('\n====== 7. 验证关联 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const orderEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await orderEntry.locator('.entry-set-icon').click({ force: true });
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
      text = await readPage(page);

      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确' : '✗ 有问题'}`);
      if (!ok) console.log(`详情: ${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 200)}`);
    }

    // 检查录入页
    console.log('\n====== 8. 录入页检查 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`录入页显示订单明细: ${text.includes('订单明细') ? '✓' : '✗'}`);
    console.log(text.substring(0, 800));

    await page.screenshot({ path: 'screenshots/v9-entry-form.png', fullPage: true });
    console.log('\n====== V9 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
