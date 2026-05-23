/**
 * 彻底修复关联子表：
 * 1. 删除多余的"关联子表"表单
 * 2. 删除订单管理上失效的关联子表字段
 * 3. 重新添加关联子表，用"绑定已有表单"选择订单明细表
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
  console.log('[FIX SUBTABLE V2]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    // ====== 1. 删除多余的"关联子表"表单 ======
    console.log('====== 1. 清理多余表单 ======');
    let formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`当前表单: ${formNames.join(' | ')}`);

    if (formNames.includes('关联子表')) {
      console.log('删除"关联子表"表单...');
      const entry = page.locator('.tree-node').filter({ hasText: '关联子表' }).first();
      await entry.hover({ force: true });
      await page.waitForTimeout(600);
      await entry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);
      await page.locator('li:has-text("删除")').last().click({ force: true });
      await page.waitForTimeout(1000);

      const alertText = await page.locator('[class*="x-alert"]').first().innerText().catch(() => '');
      console.log(`  弹窗: ${alertText.substring(0, 200).replace(/\n/g, ' ')}`);

      if (alertText.includes('确定要删除')) {
        const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
        if (await delBtn.count() > 0) {
          await page.waitForTimeout(3000);
          await delBtn.click({ force: true }).catch(() => {});
          console.log('  ✓ 已删除');
          await page.waitForTimeout(2000);
        }
      } else {
        await page.locator('button:has-text("我知道了")').last().click({ force: true }).catch(() => {});
      }
    }

    await goHome(page);
    formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`清理后: ${formNames.join(' | ')}`);

    // ====== 2. 进入订单管理编辑器重新配置关联子表 ======
    console.log('\n====== 2. 修复订单管理的关联子表 ======');
    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 列出字段
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    // 删除现有的失效关联子表字段
    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log(`删除失效的订单明细字段 [${subIdx}]...`);
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(600);

      const deleteBtn = subField.locator('.btn-delete.btn-trash, i[title="删除"]').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(1000);

        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定"), [class*="alert"] button:has-text("删除")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          console.log('✓ 已删除');
          await page.waitForTimeout(1000);
        }
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // ====== 3. 重新添加关联子表 - 这次用"绑定已有表单" ======
    console.log('\n====== 3. 添加关联子表 - 绑定已有订单明细表 ======');

    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 设标题
    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    let text = await readPage(page);

    // 先看看属性面板有什么选项
    console.log(`属性面板:\n${text.substring(0, 1500)}`);

    // 应该有两个选项：绑定已有表单 和 从空白新建
    // 选"绑定已有表单"
    const bindExisting = page.locator('text=绑定已有表单').first();
    if (await bindExisting.count() > 0 && await bindExisting.isVisible().catch(() => false)) {
      await bindExisting.click({ force: true });
      console.log('✓ 已选择绑定已有表单');
      await page.waitForTimeout(1500);
    }

    text = await readPage(page);
    console.log(`选择绑定已有表单后:\n${text.substring(0, 1500)}`);

    // 应该出现一个弹窗："选择表单"按钮 + "取消" "确定"
    // 点击"选择表单"
    const selectFormBtn = page.locator('button:has-text("选择表单")').first();
    const selectFormSpan = page.locator('span:has-text("选择表单")').first();
    let clickedSelect = false;

    if (await selectFormBtn.count() > 0 && await selectFormBtn.isVisible().catch(() => false)) {
      await selectFormBtn.click({ force: true });
      clickedSelect = true;
    } else if (await selectFormSpan.count() > 0 && await selectFormSpan.isVisible().catch(() => false)) {
      await selectFormSpan.click({ force: true });
      clickedSelect = true;
    }

    if (clickedSelect) {
      console.log('已点击选择表单');
      await page.waitForTimeout(2000);

      text = await readPage(page);
      console.log(`选择表单弹窗:\n${text.substring(0, 1500)}`);

      // 找订单明细表选项
      const detailOpt = page.locator('[class*="option"]:has-text("订单明细表")').first();
      const detailLi = page.locator('li:has-text("订单明细表")').first();
      let selected = false;

      if (await detailOpt.count() > 0 && await detailOpt.isVisible().catch(() => false)) {
        await detailOpt.click({ force: true });
        selected = true;
      } else if (await detailLi.count() > 0 && await detailLi.isVisible().catch(() => false)) {
        await detailLi.click({ force: true });
        selected = true;
      } else {
        // 尝试文本点击
        const detailText = page.getByText('订单明细表', { exact: true }).first();
        if (await detailText.count() > 0) {
          await detailText.click({ force: true }).catch(() => {});
          selected = true;
        }
      }

      if (selected) {
        console.log('✓ 已选择订单明细表');
        await page.waitForTimeout(500);
      }

      // 确定
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        console.log('✓ 已确定');
        await page.waitForTimeout(1500);
      }
    } else {
      // 可能已经有下拉显示了，直接找
      const allDDs = page.locator('.x-biz-dropdown-label');
      const ddCount = await allDDs.count();
      console.log(`\ndropdown: ${ddCount}个`);
      for (let i = 0; i < ddCount; i++) {
        const dd = allDDs.nth(i);
        const ddText = await dd.innerText().catch(() => '');
        const ddVisible = await dd.isVisible().catch(() => false);
        if (ddVisible) {
          console.log(`  [${i}] "${ddText}"`);
          if (!ddText.trim() || ddText.includes('请选择')) {
            await dd.click({ force: true });
            await page.waitForTimeout(1000);

            text = await readPage(page);
            console.log(`  下拉选项:\n  ${text.substring(0, 800).replace(/\n/g, '\n  ')}`);

            const detailOpt = page.locator('[class*="option"]:has-text("订单明细表"), li:has-text("订单明细表")').first();
            if (await detailOpt.count() > 0 && await detailOpt.isVisible().catch(() => false)) {
              await detailOpt.click({ force: true });
              console.log('  ✓ 已选择订单明细表');
              await page.waitForTimeout(500);
            }
            break;
          }
        }
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== 4. 验证 ======
    console.log('\n====== 4. 最终验证 ======');

    // 重新点击订单明细字段验证
    const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await subField.count() > 0) {
      await subField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      if (text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联子表')) {
        console.log('✓ 关联子表已正确绑定到订单明细表！');
      } else {
        console.log(`验证结果:\n${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 200)}`);
      }
    }

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`画布字段: ${fields.join(' | ')}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
