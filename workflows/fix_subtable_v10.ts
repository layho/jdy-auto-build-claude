/**
 * 修复关联子表 V10：
 * 使用 dispatchEvent 打开 dialog（V9 发现 click({force:true}) 不能正确触发 dialog）
 * 核心流程与 V8 相同但更健壮
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
  console.log('[FIX SUBTABLE V10]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 检查并删除表单列表中多余的订单明细表 ======
    console.log('====== 1. 清理 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const oldDetail = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    if (await oldDetail.count() > 0) {
      const name = await oldDetail.locator('.entry-name').innerText().catch(() => '');
      console.log(`发现: ${name}`);
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
    }

    // ====== 2. 进入编辑器 ======
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

    // ====== 3. 删除所有多余的关联子表字段，只保留前4个核心字段 ======
    const keepFields = ['关联客户', '选择产品', '订单编号', '下单日期'];
    for (let i = fields.length - 1; i >= 0; i--) {
      if (!keepFields.includes(fields[i])) {
        console.log(`删除多余字段: ${fields[i]}`);
        const fieldEl = page.locator('.fx-field-layout.field').nth(i);
        await fieldEl.click({ force: true });
        await page.waitForTimeout(600);
        const deleteBtn = fieldEl.locator('.btn-delete.btn-trash').first();
        if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
          await deleteBtn.click({ force: true });
          await page.waitForTimeout(800);
          const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
          if (await confirmBtn.count() > 0) await confirmBtn.click({ force: true });
          await page.waitForTimeout(1000);
        }
      }
    }

    // 保存清理后的表单
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`清理后字段: ${fields.join(' | ')}`);

    // ====== 4. 用 dispatchEvent 添加关联子表 ======
    console.log('\n====== 4. 添加关联子表 ======');

    // 使用 evaluate + dispatchEvent 来触发（诊断证实这种方有效）
    await page.evaluate(() => {
      const labels = [...document.querySelectorAll('li.form-edit-widget-label')];
      const subTable = labels.find(el => el.textContent?.includes('关联子表'));
      if (subTable) {
        (subTable as HTMLElement).click();
      }
    });
    await page.waitForTimeout(2000);

    let text = await readPage(page);
    console.log(`Dialog打开: ${text.includes('添加关联子表')}`);

    if (!text.includes('添加关联子表')) {
      console.log('重试...');
      await page.evaluate(() => {
        const labels = [...document.querySelectorAll('li.form-edit-widget-label')];
        const subTable = labels.find(el => el.textContent?.includes('关联子表'));
        if (subTable) {
          (subTable as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
      await page.waitForTimeout(2000);
      text = await readPage(page);
      console.log(`Dialog打开(重试): ${text.includes('添加关联子表')}`);
    }

    if (!text.includes('添加关联子表')) {
      console.log('⚠ 无法打开dialog');
      await page.screenshot({ path: 'screenshots/v10-no-dialog.png', fullPage: true });
      return;
    }

    // 设标题
    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    console.log('✓ 标题: 订单明细');
    await page.waitForTimeout(300);

    // 选"从空白新建"
    text = await readPage(page);
    const blankOption = page.getByText('从空白新建').first();
    if (await blankOption.count() > 0 && await blankOption.isVisible().catch(() => false)) {
      await blankOption.click({ force: true });
      console.log('✓ 从空白新建');
      await page.waitForTimeout(1000);
    }

    // 填表单名
    const nameInput = page.locator('.fx-relatedform-create-path input.input-inner').first();
    if (await nameInput.count() > 0) {
      await nameInput.click({ clickCount: 3, force: true });
      await nameInput.fill('订单明细表');
      console.log('✓ 表单名: 订单明细表');
      await page.waitForTimeout(300);
    }

    // 点确定
    const dialogConfirm = page.locator('.fx-relatedform-create-path button:has-text("确定")').first();
    if (await dialogConfirm.count() > 0 && await dialogConfirm.isVisible().catch(() => false)) {
      await dialogConfirm.click({ force: true });
      console.log('✓ 已确定');
      await page.waitForTimeout(3000);
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== 5. 验证订单明细表已创建 ======
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n表单: ${formNames.join(' | ')}`);

    if (!formNames.includes('订单明细表')) {
      console.log('⚠ 订单明细表未创建');
      await page.screenshot({ path: 'screenshots/v10-fail.png', fullPage: true });
      return;
    }

    // ====== 6. 添加业务字段到订单明细表 ======
    console.log('\n====== 6. 添加字段到订单明细表 ======');
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
        detailFields.push(field.name);
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
      text = await readPage(page);

      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确' : '✗ 有问题'}`);
      if (!ok) console.log(`详情: ${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 200)}`);
    }

    // 录入页检查
    console.log('\n====== 8. 录入页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`录入页显示订单明细: ${text.includes('订单明细') ? '✓' : '✗'}`);
    console.log(text.substring(0, 600));

    await page.screenshot({ path: 'screenshots/v10-final.png', fullPage: true });
    console.log('\n====== V10 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
