/**
 * 最终端到端测试 V4：
 * 关键发现：关联子表只在"管理全部数据"视图 + "添加"按钮打开的完整表单中显示
 * 流程：
 * 1. 切换到"管理全部数据"视图
 * 2. 点"添加"打开完整录入表单
 * 3. 填写所有字段（包括子表）
 * 4. 提交
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
  console.log('[FINAL E2E V4]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入并切换视图 ======
    console.log('====== 1. 切换到管理全部数据 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`当前视图: ${text.includes('仅添加数据') ? '仅添加数据' : text.includes('管理全部数据') ? '管理全部数据' : '未知'}`);

    // 如果不是管理全部数据，切换
    if (text.includes('仅添加数据')) {
      const viewToggle = page.locator('text=仅添加数据').first();
      await viewToggle.click({ force: true });
      await page.waitForTimeout(1000);

      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据"), li:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) {
        await manageAll.click({ force: true });
        console.log('✓ 已切换到管理全部数据');
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
      }
    }

    text = await readPage(page);
    console.log(`切换后:\n${text.substring(0, 800)}`);

    // ====== 2. 点击"添加"打开录入表单 ======
    console.log('\n====== 2. 打开录入表单 ======');
    const addBtn = page.locator('button:has-text("添加")').first();
    console.log(`"添加"按钮: ${await addBtn.count()}个`);

    if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
      await addBtn.click({ force: true });
      console.log('✓ 已点击添加');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
    }

    text = await readPage(page);
    console.log(`\n录入表单:\n${text.substring(0, 1500)}`);
    console.log(`子表显示: ${text.includes('订单明细') ? '✓' : '✗'}`);
    await page.screenshot({ path: 'screenshots/e2ev4-1-form.png', fullPage: true });

    // ====== 3. 填写订单编号 ======
    console.log('\n====== 3. 填写基本信息 ======');
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

    if (formInputs.length >= 1) {
      await formInputs[0].fill('ORD-20260523-002');
      console.log('✓ 订单编号: ORD-20260523-002');
    }

    // ====== 4. 关联客户 ======
    console.log('\n====== 4. 关联客户 ======');
    const assocBtns = page.locator('button:has-text("关联数据")');
    console.log(`"关联数据": ${await assocBtns.count()}个`);

    for (let i = 0; i < await assocBtns.count(); i++) {
      const btn = assocBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log(`✓ 已点击[${i}]`);
        await page.waitForTimeout(3000);
        break;
      }
    }

    text = await readPage(page);
    console.log(`面板:\n${text.substring(0, 800)}`);

    // 选张三
    const zhangSanRow = page.locator('tr:has-text("张三"), [class*="row"]:has-text("张三")').first();
    if (await zhangSanRow.count() > 0) {
      const radio = zhangSanRow.locator('input[type="radio"]').first();
      if (await radio.count() > 0) {
        await radio.click({ force: true });
      } else {
        await zhangSanRow.click({ force: true });
      }
      console.log('✓ 已选张三');
      await page.waitForTimeout(500);
    }

    // 按Enter确认
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // ====== 5. 选择产品 ======
    console.log('\n====== 5. 选择产品 ======');
    const chooseBtns = page.locator('button:has-text("选择数据")');
    for (let i = 0; i < await chooseBtns.count(); i++) {
      const btn = chooseBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log(`✓ 已点击[${i}]`);
        await page.waitForTimeout(3000);
        break;
      }
    }

    text = await readPage(page);
    console.log(`产品面板:\n${text.substring(0, 800)}`);

    // 注意：面板可能显示客户数据（如果前一个面板没关）
    const smartPhoneRow = page.locator('tr:has-text("智能手机"), [class*="row"]:has-text("智能手机")').first();
    if (await smartPhoneRow.count() > 0) {
      const radio = smartPhoneRow.locator('input[type="radio"]').first();
      if (await radio.count() > 0) {
        await radio.click({ force: true });
      } else {
        await smartPhoneRow.click({ force: true });
      }
      console.log('✓ 已选智能手机');
    } else {
      console.log('⚠ 未找到智能手机行，可能面板显示的是客户数据');
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // ====== 6. 填写子表 ======
    console.log('\n====== 6. 填写子表 ======');
    await page.screenshot({ path: 'screenshots/e2ev4-2-before-subtable.png', fullPage: true });
    text = await readPage(page);
    console.log(`子表前:\n${text.substring(0, 1500)}`);

    // 查找子表"添加"按钮 - 在"订单明细"标题附近
    const allAddBtns = page.locator('button:has-text("添加")');
    const addCount = await allAddBtns.count();
    console.log(`"添加"按钮: ${addCount}个`);

    // 点击最后一个可见的"添加"（通常子表的添加按钮在后面）
    for (let i = addCount - 1; i >= 0; i--) {
      const btn = allAddBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        const nearbyText = await btn.locator('..').locator('..').innerText().catch(() => '').then(t => t.substring(0, 60));
        console.log(`  点击[${i}]附近="${nearbyText}"`);
        await btn.click({ force: true });
        await page.waitForTimeout(2000);
        break;
      }
    }

    text = await readPage(page);
    console.log(`\n添加子表行后:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/e2ev4-3-subtable-open.png', fullPage: true });

    // 查找新增的子表输入框
    const allEditableInputs = page.locator('input.input-inner:not([readonly])');
    const aeiCount = await allEditableInputs.count();
    console.log(`所有输入框: ${aeiCount}个`);

    // 找空的非搜索输入框
    const emptyInputs: any[] = [];
    for (let i = 0; i < aeiCount; i++) {
      const inp = allEditableInputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!val && (!ph || !ph.includes('搜索'))) {
        emptyInputs.push(inp);
        console.log(`  空[${i}]: ph="${ph}"`);
      }
    }
    console.log(`可用空输入框: ${emptyInputs.length}个`);

    const fillData = ['智能手机', '2', '2999', '5998'];
    for (let i = 0; i < Math.min(emptyInputs.length, fillData.length); i++) {
      await emptyInputs[i].fill(fillData[i]);
      console.log(`  ✓ [${i}] = ${fillData[i]}`);
    }

    // 确认子表行 - 点确定/保存
    const confirmSubRow = page.locator('button:has-text("确定")').last();
    if (await confirmSubRow.count() > 0 && await confirmSubRow.isVisible().catch(() => false)) {
      await confirmSubRow.click({ force: true });
      console.log('✓ 子表行已确认');
      await page.waitForTimeout(1000);
    }

    // ====== 7. 提交 ======
    console.log('\n====== 7. 提交 ======');
    await page.screenshot({ path: 'screenshots/e2ev4-4-final.png', fullPage: true });

    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`\n提交结果:\n${text.substring(0, 800)}`);
    const success = text.includes('成功');
    console.log(`状态: ${success ? '✓ 成功' : '⚠ 待确认'}`);

    await page.screenshot({ path: 'screenshots/e2ev4-5-result.png', fullPage: true });
    console.log('\n====== E2E V4 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
