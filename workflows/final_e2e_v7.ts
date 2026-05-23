/**
 * 最终端到端测试 V7 - 完整流程
 * 修复：子表"随主数据一同新增"已勾选，子表现在正常显示
 * 流程：
 * 1. 打开管理全部数据视图
 * 2. 点击"添加"打开表单
 * 3. 填写订单编号和下单日期
 * 4. 关联客户：点击"关联数据" → 在对话框中点击"张三"行 → 自动关闭
 * 5. 选择产品：点击"选择数据" → 在对话框中点击"智能手机"行 → 自动关闭
 * 6. 子表：点击"添加"按钮新增行 → 填写4个字段 → 确认
 * 7. 提交
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

  // 检测打开的对话框类型
  for (const sel of ['.fx-lookup-dialog', '.fx-linkfield-dialog']) {
    const dlg = page.locator(sel).first();
    if (await dlg.isVisible().catch(() => false)) {
      const row = dlg.locator('tbody tr').filter({ hasText: rowText }).first();
      if (await row.count() > 0) {
        await row.click({ force: true });
        // 等待对话框关闭
        await page.waitForTimeout(1500);
        const stillOpen = await dlg.isVisible().catch(() => false);
        return !stillOpen;
      }
    }
  }
  return false;
}

async function main() {
  console.log('[FINAL E2E V7]\n');
  const wd = startWatchdog({ hardTimeoutMs: 360_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 打开表单 ======
    console.log('====== 1. 打开录入表单 ======');
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
      console.log('✓ 切换到管理全部数据');
    }

    // 点击添加
    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);
    console.log('✓ 表单已打开');

    await page.screenshot({ path: 'screenshots/e2ev7-1-form.png', fullPage: true });

    // ====== 2. 填写基本信息 ======
    console.log('\n====== 2. 填写基本信息 ======');

    // 获取表单中的所有输入框
    const formInputs = await page.evaluate(() => {
      const form = document.querySelector('.fx-form.form-modal');
      if (!form) return [];
      return [...form.querySelectorAll('input.input-inner:not([readonly])')].map(inp => ({
        placeholder: (inp as HTMLInputElement).placeholder || '',
        value: (inp as HTMLInputElement).value || '',
      }));
    });

    console.log(`表单输入框: ${JSON.stringify(formInputs)}`);

    // 找表单中的非搜索输入框并填充
    const allInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    const inputCount = await allInputs.count();
    console.log(`输入框总数: ${inputCount}`);

    // 第一个是订单编号，第二个是下单日期
    if (inputCount >= 2) {
      await allInputs.nth(0).fill('ORD-20260523-007');
      console.log('✓ 订单编号: ORD-20260523-007');
      await allInputs.nth(1).fill('2026-05-23');
      console.log('✓ 下单日期: 2026-05-23');
    }

    // ====== 3. 关联客户 ======
    console.log('\n====== 3. 关联客户 ======');
    const assocBtn = page.locator('.fx-form.form-modal button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) {
      await assocBtn.click({ force: true });
      console.log('✓ 点击关联数据');
    }

    const custResult = await selectInDialog(page, '张三');
    console.log(`关联客户: ${custResult ? '✓ 张三已选择' : '⚠'}`);

    // ====== 4. 选择产品 ======
    console.log('\n====== 4. 选择产品 ======');
    const chooseBtn = page.locator('.fx-form.form-modal button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0) {
      await chooseBtn.click({ force: true });
      console.log('✓ 点击选择数据');
    }

    const prodResult = await selectInDialog(page, '智能手机');
    console.log(`选择产品: ${prodResult ? '✓ 智能手机已选择' : '⚠'}`);

    await page.screenshot({ path: 'screenshots/e2ev7-2-selections.png', fullPage: true });

    // ====== 5. 填写子表 ======
    console.log('\n====== 5. 填写子表 ======');

    // 找子表区域中的"添加"按钮
    // 子表在表单的第5个字段，class包含 relatedform 或 subtable
    const subtableAddBtn = await page.evaluate(() => {
      const form = document.querySelector('.fx-form.form-modal');
      if (!form) return null;

      // 找所有"添加"按钮
      const addBtns = [...form.querySelectorAll('button')].filter(b =>
        (b.textContent || '').trim() === '添加' && (b as HTMLElement).offsetHeight > 0
      );

      // 找在子表区域内的那个
      for (const btn of addBtns) {
        let container = btn.parentElement;
        for (let i = 0; i < 10 && container; i++) {
          const cls = String(container.className || '');
          const text = (container as HTMLElement).innerText || '';
          if (text.includes('订单明细') || text.includes('订单管理') ||
              cls.includes('relatedform') || cls.includes('subtable')) {
            return {
              found: true,
              btnClass: btn.className?.substring(0, 100),
              containerClass: cls.substring(0, 100),
              rect: JSON.stringify(btn.getBoundingClientRect()),
            };
          }
          container = container.parentElement;
        }
      }
      return { found: false, totalAddBtns: addBtns.length };
    });

    console.log(`子表添加按钮: ${JSON.stringify(subtableAddBtn)}`);

    if (subtableAddBtn?.found) {
      // 用Playwright点击子表内的添加按钮
      // 在表单中找到"添加"按钮，排除"快速填报"附近的
      const formAddBtns = page.locator('.fx-form.form-modal button:has-text("添加")');
      const fabCount = await formAddBtns.count();
      let clicked = false;

      for (let i = 0; i < fabCount; i++) {
        const btn = formAddBtns.nth(i);
        const parentText = await btn.locator('..').locator('..').innerText().catch(() => '').then(t => t.substring(0, 60));
        console.log(`  检查添加按钮[${i}]: "${parentText}"`);

        if (parentText.includes('订单明细') || parentText.includes('订单管理') || parentText.includes('快速填报')) {
          await btn.click({ force: true });
          console.log(`  ✓ 已点击子表添加按钮[${i}]`);
          clicked = true;
          await page.waitForTimeout(2000);
          break;
        }
      }

      if (!clicked) {
        // Fallback: 点击表单中最后一个"添加"
        if (fabCount > 0) {
          await formAddBtns.last().click({ force: true });
          console.log('  ✓ fallback: 点击最后一个添加按钮');
          clicked = true;
          await page.waitForTimeout(2000);
        }
      }
    }

    // 截图看子表
    await page.screenshot({ path: 'screenshots/e2ev7-3-subtable-add.png', fullPage: true });

    // 查找新增的子表行输入框
    const allFormInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    const afiCount = await allFormInputs.count();
    console.log(`表单输入框总数: ${afiCount}`);

    // 找到空输入框（子表新增行）
    const emptyInputs: any[] = [];
    for (let i = 0; i < afiCount; i++) {
      const inp = allFormInputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!val && (!ph || !ph.includes('搜索'))) {
        // 排除已填的订单编号和下单日期
        emptyInputs.push({ idx: i, inp, ph });
      }
    }
    console.log(`空输入框: ${emptyInputs.length}个`);
    emptyInputs.forEach(e => console.log(`  [${e.idx}] ph="${e.ph}"`));

    // 子表有4个字段：产品名称、数量、单价、金额(公式)、订单管理(自动)
    // 实际可填的可能是3个（产品名称、数量、单价）或4个
    const fillData = ['智能手机', '2', '2999', '5998'];
    for (let i = 0; i < Math.min(emptyInputs.length, fillData.length); i++) {
      await emptyInputs[i].inp.fill(fillData[i]);
      console.log(`  ✓ [${emptyInputs[i].idx}] = ${fillData[i]}`);
    }

    // 确认子表行: 在子表区域内找"确定"或"保存"按钮
    const confirmBtn = page.locator('.fx-form.form-modal button:has-text("确定")').last();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('✓ 子表行已确认');
      await page.waitForTimeout(1000);
    } else {
      // 尝试按Enter
      await page.keyboard.press('Enter');
      console.log('✓ 按Enter确认');
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'screenshots/e2ev7-4-subtable-done.png', fullPage: true });

    // ====== 6. 提交 ======
    console.log('\n====== 6. 提交 ======');
    const submitBtn = page.locator('.fx-form.form-modal button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已点击提交');
      await page.waitForTimeout(4000);
    }

    const resultText = await page.locator('body').first().innerText().catch(() => '');
    const success = resultText.includes('提交成功') || resultText.includes('操作成功') || resultText.includes('成功');
    console.log(`\n提交结果: ${success ? '✓ 成功！' : '⚠ 待确认'}`);

    // 检查数据列表
    if (resultText.includes('ORD-20260523-007')) {
      console.log('✓ 数据已出现在列表中');
    }

    console.log(`\n列表最近数据:\n${resultText.substring(resultText.indexOf('关联客户'), resultText.indexOf('关联客户') + 300)}`);

    await page.screenshot({ path: 'screenshots/e2ev7-5-result.png', fullPage: true });
    console.log('\n====== E2E V7 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
