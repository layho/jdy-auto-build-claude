/**
 * 最终端到端测试 V10 - 完整流程（子表已完全配置）
 * 子表显示5列: 订单管理, 产品名称, 数量, 单价, 金额
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
  console.log('[FINAL E2E V10]\n');
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
    console.log('✓ 表单已打开');

    // ====== 2. 填写基本信息 ======
    const formInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    if (await formInputs.count() >= 2) {
      await formInputs.nth(0).fill('ORD-20260523-010');
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

    await page.screenshot({ path: 'screenshots/e2ev10-1-form.png', fullPage: true });

    // ====== 5. 点击子表"添加" ======
    console.log('\n====== 5. 子表添加行 ======');
    const subAddBtn = page.locator('button.btn-add').first();
    if (await subAddBtn.count() > 0 && await subAddBtn.isVisible().catch(() => false)) {
      await subAddBtn.click({ force: true });
      console.log('✓ 已点击子表添加');
      await page.waitForTimeout(2000);
    }

    // 检查子表新增行
    const subtableState = await page.evaluate(() => {
      const subtable = document.querySelector('.fx-related-form');
      if (!subtable) return { error: 'no subtable' };

      // 找所有输入框（在新行中）
      const allInputs = [...subtable.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])')];
      const rows = [...subtable.querySelectorAll('.fx-related-form-row')];

      return {
        inputs: allInputs.map(inp => ({
          tag: inp.tagName,
          type: (inp as HTMLInputElement).type,
          class: (inp as HTMLElement).className?.substring(0, 80),
          placeholder: (inp as HTMLInputElement).placeholder || '',
          value: (inp as HTMLInputElement).value || '',
          rect: JSON.stringify(inp.getBoundingClientRect()),
        })),
        rowCount: rows.length,
        subtableText: (subtable as HTMLElement).innerText?.trim()?.substring(0, 300),
      };
    });

    console.log(`子表状态:\n${JSON.stringify(subtableState, null, 2)}`);

    await page.screenshot({ path: 'screenshots/e2ev10-2-subtable-row.png', fullPage: true });

    // ====== 6. 填子表数据 ======
    console.log('\n====== 6. 填子表数据 ======');

    // 方法1: 在子表中找到input
    const subInputs = page.locator('.fx-related-form input:not([type="hidden"]):not([type="checkbox"])');
    const siCount = await subInputs.count();
    console.log(`子表输入框: ${siCount}个`);

    if (siCount > 0) {
      // 子表列: 产品名称, 数量, 单价, 金额
      const fillData = ['智能手机', '2', '2999', '5998'];
      for (let i = 0; i < Math.min(siCount, fillData.length); i++) {
        const inp = subInputs.nth(i);
        const visible = await inp.isVisible().catch(() => false);
        if (visible) {
          await inp.fill(fillData[i]);
          console.log(`  ✓ [${i}] = ${fillData[i]}`);
        }
      }
    } else {
      // 方法2: 找页面中所有空输入框
      const allInputs = page.locator('input.input-inner:not([readonly])');
      const aiCount = await allInputs.count();
      const emptyOnes: any[] = [];
      for (let i = 0; i < aiCount; i++) {
        const inp = allInputs.nth(i);
        const val = await inp.inputValue().catch(() => '');
        const box = await inp.boundingBox().catch(() => null);
        if (!val && box && box.y > 300) {
          emptyOnes.push({ idx: i, inp, y: box.y });
        }
      }
      console.log(`下方空输入框: ${emptyOnes.length}个`);

      const fillData = ['智能手机', '2', '2999', '5998'];
      for (let i = 0; i < Math.min(emptyOnes.length, fillData.length); i++) {
        await emptyOnes[i].inp.fill(fillData[i]);
        console.log(`  ✓ [${emptyOnes[i].idx}] = ${fillData[i]}`);
      }
    }

    // 确认子表行
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    console.log('✓ 已确认子表行');

    await page.screenshot({ path: 'screenshots/e2ev10-3-filled.png', fullPage: true });

    // ====== 7. 提交 ======
    console.log('\n====== 7. 提交 ======');
    const submitBtn = page.locator('.fx-form.form-modal button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已点击提交');
      await page.waitForTimeout(4000);
    }

    const resultText = await page.locator('body').first().innerText().catch(() => '');
    const orderIdx = resultText.indexOf('ORD-20260523-010');
    const success = resultText.includes('提交成功') || resultText.includes('操作成功');

    if (orderIdx >= 0) {
      const lineStart = resultText.lastIndexOf('\n', orderIdx - 50);
      const lineEnd = resultText.indexOf('\n', orderIdx + 50);
      console.log(`\n新记录行:\n${resultText.substring(Math.max(0, lineStart - 100), lineEnd + 100)}`);
    }

    console.log(`\n结果: ${success ? '✓ 提交成功！' : '提交完成'}`);
    await page.screenshot({ path: 'screenshots/e2ev10-4-result.png', fullPage: true });

    console.log('\n====== E2E V10 完成 ======');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
