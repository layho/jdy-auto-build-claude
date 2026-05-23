/**
 * 修复子表显示字段 V2 - 正确保存（不按Escape，点击外部关闭弹窗）
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[FIX COLUMNS V2]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入编辑器 ======
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

    // 点击订单明细字段
    const orderDetailField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    await orderDetailField.click({ force: true });
    console.log('✓ 已点击订单明细');
    await page.waitForTimeout(2000);

    // ====== 点击"显示字段"配置打开弹窗 ======
    // 找包含"显示 N 个字段"的元素并点击
    const displayFieldRow = page.locator('[class*="config-content"]:has-text("个字段")').first();
    if (await displayFieldRow.count() > 0) {
      await displayFieldRow.click({ force: true });
      console.log('✓ 打开显示字段选择器');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/fixcol2-1-popover.png', fullPage: true });

    // 检查弹窗中的复选框状态
    const cbState = await page.evaluate(() => {
      const popover = document.querySelector('.x-biz-multi-field-selector-popover');
      if (!popover) return { error: 'no popover' };

      const checkboxes = [...popover.querySelectorAll('input[type="checkbox"]')];
      // 获取每行的文本
      const rows = [...popover.querySelectorAll('[class*="item"], [class*="row"], li')];
      const items = rows.map(r => ({
        text: (r as HTMLElement).innerText?.trim(),
        html: (r as HTMLElement).innerHTML?.substring(0, 200),
      }));

      return {
        checkboxCount: checkboxes.length,
        checkboxes: checkboxes.map((cb, i) => ({
          index: i,
          checked: (cb as HTMLInputElement).checked,
          disabled: (cb as HTMLInputElement).disabled,
        })),
        items,
      };
    });

    console.log(`弹窗状态: ${JSON.stringify(cbState, null, 2)}`);

    // ====== 勾选所有未勾选的字段 ======
    // 跳过全选(0)和已勾选的订单管理(1)，勾选2-5
    await page.evaluate(() => {
      const popover = document.querySelector('.x-biz-multi-field-selector-popover');
      if (!popover) return;

      const checkboxes = [...popover.querySelectorAll('input[type="checkbox"]')];
      for (let i = 2; i < checkboxes.length; i++) {
        const cb = checkboxes[i] as HTMLInputElement;
        if (!cb.checked && !cb.disabled) {
          cb.click();
        }
      }
    });

    await page.waitForTimeout(500);

    // 验证勾选结果
    const cbStateAfter = await page.evaluate(() => {
      const popover = document.querySelector('.x-biz-multi-field-selector-popover');
      if (!popover) return [];

      const checkboxes = [...popover.querySelectorAll('input[type="checkbox"]')];
      return checkboxes.map((cb, i) => ({
        index: i,
        checked: (cb as HTMLInputElement).checked,
      }));
    });

    console.log(`勾选后: ${JSON.stringify(cbStateAfter)}`);

    // ====== 关键：点击弹窗外区域关闭弹窗（不要用Escape）======
    // 点击属性面板的空白区域
    await page.mouse.click(50, 300);
    await page.waitForTimeout(1000);

    // 检查弹窗是否关闭
    const popoverStillOpen = await page.locator('.x-biz-multi-field-selector-popover').first().isVisible().catch(() => false);
    console.log(`弹窗关闭: ${!popoverStillOpen ? '✓' : '✗'}`);

    if (popoverStillOpen) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: 'screenshots/fixcol2-2-configured.png', fullPage: true });

    // ====== 检查显示字段数量是否已更新 ======
    const displayCount = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[class*="config-content"]')]
        .find(e => (e as HTMLElement).innerText?.includes('个字段'));
      return el?.textContent?.trim();
    });
    console.log(`显示字段状态: ${displayCount}`);

    // ====== 保存 ======
    console.log('\n保存...');
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      console.log('✓ 已点击保存');
      await page.waitForTimeout(5000);
    }

    // ====== 验证：录入页 add 模式 ======
    console.log('\n====== 验证 add 模式 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 打开add表单
    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);

    const addSubtableColumns = await page.evaluate(() => {
      const subtable = document.querySelector('.fx-related-form');
      if (!subtable) return { error: 'no subtable in add form' };
      const headers = [...subtable.querySelectorAll('.related-form-title')];
      return {
        columnCount: headers.length,
        columns: headers.map(h => (h as HTMLElement).title || h.textContent?.trim()),
      };
    });
    console.log(`Add模式: ${JSON.stringify(addSubtableColumns)}`);

    // 关闭add表单
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // ====== 验证：view 模式 ======
    console.log('\n====== 验证 view 模式 ======');
    // 点击第一个数据行查看详情
    const firstRow = page.locator('tr:has-text("ORD-20260523-010")').first();
    if (await firstRow.count() > 0) {
      await firstRow.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const viewSubtable = await page.evaluate(() => {
        // 找详情中的子表
        const subtable = document.querySelector('[class*="related-form"], [class*="subtable"], [class*="relatedform"]');
        if (!subtable) return { error: 'no subtable in detail view' };

        const headers = [...subtable.querySelectorAll('[class*="title"]')];
        return {
          class: (subtable as HTMLElement).className?.substring(0, 200),
          headerCount: headers.length,
          headers: headers.map(h => h.textContent?.trim()),
          innerText: (subtable as HTMLElement).innerText?.trim()?.substring(0, 300),
        };
      });

      console.log(`View模式: ${JSON.stringify(viewSubtable, null, 2)}`);
    }

    await page.screenshot({ path: 'screenshots/fixcol2-3-verify.png', fullPage: true });
    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
