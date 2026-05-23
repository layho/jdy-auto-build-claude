/**
 * 修复关联子表 V5：在dialog中完成"绑定已有表单"流程
 * 关键：点击"选择表单"后等待弹出选择列表
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
  console.log('[FIX SUBTABLE V5]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

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

    // ====== 添加关联子表 ======
    console.log('添加关联子表...');
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    let text = await readPage(page);
    console.log(`Dialog状态: ${text.includes('添加关联子表') ? '已打开' : '未打开'}`);

    // 选择"从空白新建"（这比绑定已有表单更可靠）
    const blankOption = page.getByText('从空白新建').first();
    if (await blankOption.count() > 0 && await blankOption.isVisible().catch(() => false)) {
      await blankOption.click({ force: true });
      console.log('✓ 已选择从空白新建');
      await page.waitForTimeout(1000);
    }

    text = await readPage(page);
    console.log(`\n从空白新建后:\n${text.substring(text.indexOf('添加关联子表'), text.indexOf('添加关联子表') + 500)}`);

    // 看看有没有表单名称输入框
    const formInputs = page.locator('input.input-inner').last();
    const fiCount = await formInputs.count();
    if (fiCount > 0) {
      const fiText = await formInputs.inputValue().catch(() => '');
      console.log(`表单名输入框当前值: "${fiText}"`);

      // 清空并填"订单明细表"
      await formInputs.click({ clickCount: 3, force: true });
      await formInputs.fill('订单明细表');
      await page.waitForTimeout(300);
      console.log('✓ 已设置表单名: 订单明细表');
    }

    // 查找"设计关联表"或"确定"按钮
    const designBtn = page.locator('button:has-text("设计关联表")').first();
    const confirmBtn = page.locator('button:has-text("确定")').last();

    if (await designBtn.count() > 0 && await designBtn.isVisible().catch(() => false)) {
      await designBtn.click({ force: true });
      console.log('✓ 已点击设计关联表');
      await page.waitForTimeout(3000);
    } else if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('✓ 已点击确定');
      await page.waitForTimeout(3000);
    }

    // 保存
    text = await readPage(page);
    console.log(`\n保存前:\n${text.substring(0, 500)}`);

    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== 验证 ======
    const fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`\n最终字段: ${fields.join(' | ')}`);

    if (fields.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);
      console.log(`关联表: ${text.includes('订单明细表') && !text.includes('已删除') ? '✓ 正确' : '⚠ 检查'}`);

      if (!text.includes('订单明细表') || text.includes('已删除')) {
        console.log(`关联表详情: ${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 200)}`);
      }
    }

    // ====== 测试录入页 ======
    console.log('\n====== 测试录入页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`录入页:\n${text.substring(0, 600)}`);

    // 检查子表是否显示
    const hasSubTable = text.includes('订单明细') || text.includes('子表');
    console.log(`子表显示: ${hasSubTable ? '✓' : '✗'}`);

    await page.screenshot({ path: 'screenshots/subtable-v5.png', fullPage: true });

    // 列出所有表单
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n表单列表: ${formNames.join(' | ')}`);

    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
