/**
 * 最终端到端测试 V3：
 * - 关联子表已修复（✓ 正确绑定到订单明细表）
 * - 针对右侧滑出面板的弹窗，使用 Enter 键确认选择
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

async function dumpButtons(page: Page, label: string) {
  const btns = await page.evaluate(() => {
    return [...document.querySelectorAll('button')]
      .filter(b => (b as HTMLElement).offsetHeight > 0)
      .map(b => ({
        text: (b.textContent || '').trim().substring(0, 50),
        class: b.className?.substring(0, 100),
      }));
  });
  console.log(`[${label}] 按钮 (${btns.length}): ${btns.filter(b => b.text).map(b => `"${b.text}"`).join(' | ')}`);
}

async function main() {
  console.log('[FINAL E2E V3]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 打开订单管理录入页 ======
    console.log('====== 1. 打开录入页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`录入页:\n${text.substring(0, 800)}`);
    await page.screenshot({ path: 'screenshots/e2ev3-1-entry.png', fullPage: true });

    // ====== 2. 填写订单编号 ======
    console.log('\n====== 2. 填写基本信息 ======');
    const allInputs = page.locator('input.input-inner:not([readonly])');
    const allCount = await allInputs.count();
    const formInputs: any[] = [];
    for (let i = 0; i < allCount; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) {
        formInputs.push(inp);
      }
    }
    console.log(`表单输入框: ${formInputs.length}个`);

    if (formInputs.length >= 1) await formInputs[0].fill('ORD-20260523-001');
    console.log('✓ 订单编号: ORD-20260523-001');

    // ====== 3. 关联客户 ======
    console.log('\n====== 3. 关联客户 ======');
    const assocBtn = page.locator('button.data-select-btn:has-text("关联数据")').first();
    if (await assocBtn.count() === 0) {
      // fallback
      await page.locator('button:has-text("关联数据")').first().click({ force: true });
    } else {
      await assocBtn.click({ force: true });
    }
    console.log('✓ 已点击关联数据');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/e2ev3-2-customer-panel.png', fullPage: true });
    await dumpButtons(page, '关联数据面板');

    text = await readPage(page);
    console.log(`面板内容:\n${text.substring(0, 800)}`);

    // 在面板中选张三
    const zhangSan = page.locator('tr:has-text("张三"), [class*="row"]:has-text("张三")').first();
    if (await zhangSan.count() > 0) {
      const radio = zhangSan.locator('input[type="radio"]').first();
      if (await radio.count() > 0) {
        await radio.click({ force: true });
      } else {
        await zhangSan.click({ force: true });
      }
      console.log('✓ 已选择张三');
      await page.waitForTimeout(500);
    }

    // 面板没有确定按钮，尝试用Enter键确认
    console.log('按Enter确认...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    text = await readPage(page);
    const panelClosed = !text.includes('数据标题') || text.includes('订单编号');
    console.log(`面板关闭: ${panelClosed ? '✓' : '✗'}`);

    if (!panelClosed) {
      // 尝试点面板的关闭按钮或按Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    }

    // ====== 4. 选择产品 ======
    console.log('\n====== 4. 选择产品 ======');
    text = await readPage(page);
    console.log(`当前页面:\n${text.substring(0, 500)}`);

    await dumpButtons(page, '选择产品前');

    const chooseBtn = page.locator('button.data-select-btn:has-text("选择数据")').first();
    if (await chooseBtn.count() === 0) {
      await page.locator('button:has-text("选择数据")').first().click({ force: true });
    } else {
      await chooseBtn.click({ force: true });
    }
    console.log('✓ 已点击选择数据');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/e2ev3-3-product-panel.png', fullPage: true });

    text = await readPage(page);
    console.log(`产品面板:\n${text.substring(0, 800)}`);

    // 选智能手机
    const smartPhone = page.locator('tr:has-text("智能手机"), [class*="row"]:has-text("智能手机")').first();
    if (await smartPhone.count() > 0) {
      const radio = smartPhone.locator('input[type="radio"]').first();
      if (await radio.count() > 0) {
        await radio.click({ force: true });
      } else {
        await smartPhone.click({ force: true });
      }
      console.log('✓ 已选择智能手机');
      await page.waitForTimeout(500);
    } else {
      console.log('⚠ 未找到智能手机');
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // ====== 5. 子表数据 ======
    console.log('\n====== 5. 填写子表 ======');
    await page.waitForTimeout(1000);
    text = await readPage(page);
    console.log(`当前页面:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/e2ev3-4-before-subtable.png', fullPage: true });

    await dumpButtons(page, '子表前');

    // 查找子表区域的"添加"按钮
    // 子表可能在"订单明细"标题下方
    const allAddBtns = page.locator('button:has-text("添加"), span:has-text("添加"), a:has-text("添加")');
    const aabCount = await allAddBtns.count();
    console.log(`"添加"元素: ${aabCount}个`);

    let subAddClicked = false;
    for (let i = 0; i < aabCount; i++) {
      const el = allAddBtns.nth(i);
      const vis = await el.isVisible().catch(() => false);
      if (vis) {
        const cls = await el.getAttribute('class').catch(() => '');
        console.log(`  点击 [${i}] class="${cls?.substring(0, 80)}"`);
        await el.click({ force: true });
        subAddClicked = true;
        await page.waitForTimeout(2000);
        break;
      }
    }

    text = await readPage(page);
    console.log(`\n点击添加后:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/e2ev3-5-subtable-row.png', fullPage: true });

    if (subAddClicked) {
      // 查找新增的子表行输入框
      const allEditableInputs = page.locator('input.input-inner:not([readonly])');
      const aeiCount = await allEditableInputs.count();
      console.log(`所有输入框: ${aeiCount}个`);

      // 找空的输入框（子表新增的行应该是空的）
      const emptyInputs: any[] = [];
      for (let i = 0; i < aeiCount; i++) {
        const inp = allEditableInputs.nth(i);
        const val = await inp.inputValue().catch(() => '');
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        if (!val && (!ph || !ph.includes('搜索'))) {
          emptyInputs.push(inp);
          console.log(`  空输入框[${i}]: ph="${ph}"`);
        }
      }
      console.log(`可用空输入框: ${emptyInputs.length}个`);

      const fillData = ['智能手机', '2', '2999', '5998'];
      for (let i = 0; i < Math.min(emptyInputs.length, fillData.length); i++) {
        await emptyInputs[i].fill(fillData[i]);
        console.log(`  ✓ [${i}] = ${fillData[i]}`);
      }

      // 确认子表行 - 查找确定/保存按钮
      const saveRowBtns = page.locator('button:has-text("确定"), button:has-text("保存")');
      for (let i = await saveRowBtns.count() - 1; i >= 0; i--) {
        const btn = saveRowBtns.nth(i);
        const btnText = await btn.innerText().catch(() => '');
        const btnVis = await btn.isVisible().catch(() => false);
        if (btnVis && (btnText === '确定' || btnText === '保存')) {
          console.log(`  点击子表行${btnText}按钮 [${i}]`);
          await btn.click({ force: true });
          await page.waitForTimeout(1000);
          break;
        }
      }
    }

    // ====== 6. 提交 ======
    console.log('\n====== 6. 提交 ======');
    await page.screenshot({ path: 'screenshots/e2ev3-6-before-submit.png', fullPage: true });
    text = await readPage(page);
    console.log(`提交前:\n${text.substring(0, 1500)}`);

    await dumpButtons(page, '提交前');

    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已点击提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`\n提交结果:\n${text.substring(0, 800)}`);
    const success = text.includes('提交成功') || text.includes('操作成功') || text.includes('成功');
    console.log(`状态: ${success ? '✓ 成功' : '⚠ 待确认'}`);

    await page.screenshot({ path: 'screenshots/e2ev3-7-result.png', fullPage: true });
    console.log('\n====== E2E V3 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
