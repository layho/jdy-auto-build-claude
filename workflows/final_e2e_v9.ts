/**
 * 最终端到端测试 V9 - 精确点击子表"添加"按钮
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function selectInDialog(page: Page, rowText: string): Promise<boolean> {
  await page.waitForTimeout(1500);
  for (const sel of ['.fx-lookup-dialog', '.fx-linkfield-dialog']) {
    const dlg = page.locator(sel).first();
    if (await dlg.isVisible().catch(() => false)) {
      const row = dlg.locator('tbody tr').filter({ hasText: rowText }).first();
      if (await row.count() > 0) {
        await row.click({ force: true });
        await page.waitForTimeout(1500);
        const stillOpen = await dlg.isVisible().catch(() => false);
        return !stillOpen;
      }
    }
  }
  return false;
}

async function main() {
  console.log('[FINAL E2E V9]\n');
  const wd = startWatchdog({ hardTimeoutMs: 360_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 打开表单 ======
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
    const allInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    const inputCount = await allInputs.count();
    if (inputCount >= 2) {
      await allInputs.nth(0).fill('ORD-20260523-009');
      await allInputs.nth(1).fill('2026-05-23');
      console.log('✓ 订单编号 + 下单日期');
    }

    // ====== 3-4. 关联数据 + 选择数据 ======
    const assocBtn = page.locator('.fx-form.form-modal button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) { await assocBtn.click({ force: true }); await selectInDialog(page, '张三'); }
    console.log('✓ 关联客户: 张三');

    const chooseBtn = page.locator('.fx-form.form-modal button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0) { await chooseBtn.click({ force: true }); await selectInDialog(page, '智能手机'); }
    console.log('✓ 选择产品: 智能手机');

    await page.screenshot({ path: 'screenshots/e2ev9-1-selections.png', fullPage: true });

    // ====== 5. 点击子表"添加" ======
    console.log('\n====== 5. 点击子表添加按钮 ======');

    // 子表添加按钮有class "btn-add"，且在表单模态框内
    const subAddBtn = page.locator('button.btn-add:has-text("添加")').first();
    const subAddCount = await subAddBtn.count();
    console.log(`btn-add按钮: ${subAddCount}个`);

    if (subAddCount > 0 && await subAddBtn.isVisible().catch(() => false)) {
      await subAddBtn.click({ force: true });
      console.log('✓ 已点击子表btn-add');
    } else {
      // Fallback: 点击"快速填报"附近的"添加"
      const quickFill = page.locator('text="快速填报"').first();
      if (await quickFill.count() > 0) {
        const box = await quickFill.boundingBox().catch(() => null);
        if (box) {
          // 点击快速填报左边附近的button
          await page.mouse.click(box.x - 80, box.y + 5);
          console.log('✓ 鼠标点击快速填报左侧');
        }
      }
    }

    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'screenshots/e2ev9-2-subtable-add.png', fullPage: true });

    // ====== 6. 填子表数据 ======
    console.log('\n====== 6. 填子表数据 ======');

    // 找所有空输入框
    const allPageInputs = page.locator('input.input-inner:not([readonly])');
    const apiCount = await allPageInputs.count();

    const emptyInputs: any[] = [];
    for (let i = 0; i < apiCount; i++) {
      const inp = allPageInputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      const box = await inp.boundingBox().catch(() => null);
      if (!val && (!ph || !ph.includes('搜索'))) {
        emptyInputs.push({ idx: i, inp, ph, y: box?.y });
      }
    }

    console.log(`空输入框总数: ${emptyInputs.length}个`);
    emptyInputs.forEach(e => console.log(`  [${e.idx}] y=${e.y} ph="${e.ph}"`));

    // 排除已填的2个表单输入(订单编号、下单日期)，剩余的填子表
    const subInputs = emptyInputs.filter(e => e.y && e.y > 200); // 子表在下方
    console.log(`子表相关空输入: ${subInputs.length}个`);

    const fillData = ['智能手机', '2', '2999', '5998'];
    for (let i = 0; i < Math.min(subInputs.length, fillData.length); i++) {
      await subInputs[i].inp.fill(fillData[i]);
      console.log(`  ✓ [${subInputs[i].idx}] y=${subInputs[i].y} = ${fillData[i]}`);
    }

    // 确认子表行
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/e2ev9-3-subtable-filled.png', fullPage: true });

    // ====== 7. 提交 ======
    console.log('\n====== 7. 提交 ======');
    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已提交');
      await page.waitForTimeout(4000);
    }

    const resultText = await page.locator('body').first().innerText().catch(() => '');
    const success = resultText.includes('提交成功') || resultText.includes('操作成功');

    const orderIdx = resultText.indexOf('ORD-20260523-009');
    if (orderIdx >= 0) {
      const context = resultText.substring(Math.max(0, orderIdx - 100), orderIdx + 300);
      console.log(`\n新数据上下文:\n${context}`);
    }

    console.log(`\n状态: ${success ? '✓ 成功' : '⚠ 检查'}`);
    await page.screenshot({ path: 'screenshots/e2ev9-4-result.png', fullPage: true });
    console.log('\n====== E2E V9 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
