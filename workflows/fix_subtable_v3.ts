/**
 * 修复关联子表 V3：
 * 1. 删除当前失效的订单明细字段
 * 2. 重新添加，使用"从空白新建"（避免"没有可选择的表单"问题）
 * 3. 新建表单时：不新建，而是选已有的订单明细表
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
  console.log('[FIX SUBTABLE V3]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入订单管理编辑器
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

    // ====== 1. 列出并删除失效的订单明细字段 ======
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log(`删除失效字段 [${subIdx}]...`);
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(600);

      const deleteBtn = subField.locator('.btn-delete.btn-trash, i[title="删除"]').first();
      await deleteBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);

      const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
      console.log('✓ 已删除');
    }

    await page.locator('button:has-text("保存")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // ====== 2. 重新添加关联子表 ======
    console.log('\n====== 2. 添加关联子表 ======');
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    let text = await readPage(page);

    // 先看看是弹出dialog还是内联属性面板
    // 如果看到"添加关联子表"和"绑定已有表单/从空白新建"，这是dialog
    if (text.includes('添加关联子表') && text.includes('从空白新建')) {
      console.log('检测到关联子表选择dialog');

      // 点击"绑定已有表单"文字
      const bindExisting = page.getByText('绑定已有表单').first();
      if (await bindExisting.count() > 0 && await bindExisting.isVisible().catch(() => false)) {
        await bindExisting.click({ force: true });
        console.log('✓ 已选择绑定已有表单');
        await page.waitForTimeout(1000);
      }

      // 现在找"选择表单" - 尝试多种方式
      text = await readPage(page);
      console.log(`dialog内容:\n${text.substring(text.indexOf('添加关联子表'), text.indexOf('添加关联子表') + 500)}`);

      // 查找所有可见的交互元素
      const allInteractive = await page.$$eval('button, a, span, div', els =>
        els.filter(el => {
          const txt = (el.textContent || '').trim();
          return txt.includes('选择表单') && (el as HTMLElement).offsetHeight > 0;
        }).map(el => ({
          tag: el.tagName,
          class: ((el as HTMLElement).className || '').substring(0, 100),
          text: (el.textContent || '').trim().substring(0, 50),
        }))
      );
      console.log(`"选择表单"相关元素: ${JSON.stringify(allInteractive)}`);

      // 尝试点击"选择表单"
      for (const selector of [
        page.getByText('选择表单').first(),
        page.locator('[class*="select-form"]').first(),
        page.locator('button:has-text("选择")').first(),
      ]) {
        if (await selector.count() > 0 && await selector.isVisible().catch(() => false)) {
          await selector.click({ force: true });
          console.log('已点击选择表单');
          await page.waitForTimeout(2000);
          break;
        }
      }

      text = await readPage(page);
      console.log(`选择表单弹窗:\n${text.substring(0, 1500)}`);

      // 找订单明细表
      await page.getByText('订单明细表').first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);

      console.log('尝试选择订单明细表');

      // 确定（可能是两级确定）
      for (let i = 0; i < 2; i++) {
        const confirmBtn = page.locator('button:has-text("确定")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          console.log(`  确定 [${i}]`);
          await page.waitForTimeout(1500);
        }
      }
    } else {
      console.log('没有弹出关联子表dialog，直接在属性面板中');
      // 可能需要点"关联表"下拉
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== 3. 验证 ======
    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`\n最终字段: ${fields.join(' | ')}`);

    if (fields.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);

      if (text.includes('订单明细表') && !text.includes('已删除') && !text.includes('没有可选择')) {
        console.log('✓ 关联子表已正确绑定到订单明细表！');
      }
    }

    // ====== 4. 测试提交 ======
    console.log('\n====== 4. 测试提交带子表的订单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`录入页:\n${text.substring(0, 800)}`);

    // 看看子表区域是否正常显示
    if (text.includes('订单明细') && text.includes('添加')) {
      console.log('✓ 子表区域显示正常');
    }

    await page.screenshot({ path: 'screenshots/subtable-final-check.png', fullPage: true });
    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
