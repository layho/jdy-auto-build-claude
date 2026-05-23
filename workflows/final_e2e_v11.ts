/**
 * 最终端到端测试 V11
 * 修复：填完子表后点击其他区域确认行，而不是按Enter
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function selectInDialog(page: Page, rowText: string): Promise<void> {
  await page.waitForTimeout(1500);
  for (const sel of ['.fx-lookup-dialog', '.fx-linkfield-dialog']) {
    const dlg = page.locator(sel).first();
    if (await dlg.isVisible().catch(() => false)) {
      const row = dlg.locator('tbody tr').filter({ hasText: rowText }).first();
      if (await row.count() > 0) {
        await row.click({ force: true });
        await page.waitForTimeout(1500);
      }
    }
  }
}

async function main() {
  console.log('[FINAL E2E V11]\n');
  const wd = startWatchdog({ hardTimeoutMs: 360_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 打开表单 ======
    console.log('====== 1. 打开表单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== 2. 填写基本信息 ======
    const formInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    if (await formInputs.count() >= 2) {
      await formInputs.nth(0).fill('ORD-20260523-011');
      await formInputs.nth(1).fill('2026-05-23');
      console.log('✓ 订单编号 + 下单日期');
    }

    // ====== 3. 关联客户 ======
    const assocBtn = page.locator('.fx-form.form-modal button:has-text("关联数据")').first();
    await assocBtn.click({ force: true });
    await selectInDialog(page, '张三');
    console.log('✓ 关联客户: 张三');

    // ====== 4. 选择产品 ======
    const chooseBtn = page.locator('.fx-form.form-modal button:has-text("选择数据")').first();
    await chooseBtn.click({ force: true });
    await selectInDialog(page, '智能手机');
    console.log('✓ 选择产品: 智能手机');

    // ====== 5. 子表操作 ======
    console.log('\n====== 5. 子表添加行 ======');
    const subAddBtn = page.locator('button.btn-add').first();
    if (await subAddBtn.count() > 0) {
      await subAddBtn.click({ force: true });
      console.log('✓ 已点击子表添加');
      await page.waitForTimeout(2000);
    }

    // 获取子表输入框
    const subInputs = page.locator('.fx-related-form input:not([type="hidden"]):not([type="checkbox"])');
    const siCount = await subInputs.count();
    console.log(`子表输入框: ${siCount}个`);

    if (siCount >= 4) {
      await subInputs.nth(0).fill('智能手机');
      await subInputs.nth(1).fill('2');
      await subInputs.nth(2).fill('2999');
      await subInputs.nth(3).fill('5998');
      console.log('✓ 子表数据已填写');
    }

    // 关键：点击子表行以外的区域来确认行编辑
    // 点击子表的行号区域或点击表单的其他区域
    await page.waitForTimeout(500);

    // 点击子表上方空白区域来"blur"当前编辑
    await page.mouse.click(400, 480); // click between subtable header and inputs
    await page.waitForTimeout(1000);

    // 检查子表数据是否已确认（变成文本显示而非input）
    const afterCommit = await page.evaluate(() => {
      const subtable = document.querySelector('.fx-related-form');
      if (!subtable) return { error: 'no subtable' };
      const inputs = [...subtable.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])')];
      const cells = [...subtable.querySelectorAll('.related-form-cell:not(.empty-cell)')];
      return {
        inputCount: inputs.length,
        cellCount: cells.length,
        cellTexts: cells.map(c => (c as HTMLElement).innerText?.trim()?.substring(0, 30)),
        subtableText: (subtable as HTMLElement).innerText?.trim()?.substring(0, 300),
      };
    });
    console.log(`行确认后:\n${JSON.stringify(afterCommit, null, 2)}`);

    await page.screenshot({ path: 'screenshots/e2ev11-2-subtable.png', fullPage: true });

    // ====== 6. 提交 ======
    console.log('\n====== 6. 提交 ======');
    const submitBtn = page.locator('.fx-form.form-modal button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已提交');
      await page.waitForTimeout(4000);
    }

    const resultText = await page.locator('body').first().innerText().catch(() => '');
    const orderIdx = resultText.indexOf('ORD-20260523-011');
    if (orderIdx >= 0) {
      console.log('✓ 新记录已出现在列表中');
    }

    console.log(`\n提交完成`);

    // ====== 7. 验证 ======
    console.log('\n====== 7. 检查订单明细表 ======');
    await page.locator('.tree-node').filter({ hasText: '订单明细表' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const detailText = await page.locator('body').first().innerText().catch(() => '');
    const hasDetailData = detailText.includes('智能手机') || detailText.includes('ORD');
    console.log(`订单明细表有数据: ${hasDetailData ? '✓' : '✗'}`);

    if (hasDetailData) {
      console.log(`数据:\n${detailText.substring(0, 1500)}`);
    }

    await page.screenshot({ path: 'screenshots/e2ev11-3-result.png', fullPage: true });
    console.log('\n====== E2E V11 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
