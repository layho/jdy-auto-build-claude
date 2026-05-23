/**
 * 最终端到端测试 V2：
 * 修复弹窗处理 - 使用 page.evaluate 查找确定按钮
 * 添加详细调试日志
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
        class: b.className?.substring(0, 80),
        rect: JSON.stringify(b.getBoundingClientRect()),
      }));
  });
  console.log(`\n[${label}] 可见按钮 (${btns.length}个):`);
  btns.forEach((b, i) => {
    if (b.text) console.log(`  [${i}] "${b.text}" class="${b.class}" rect=${b.rect}`);
  });
}

async function main() {
  console.log('[FINAL E2E TEST V2]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入订单管理录入页 ======
    console.log('====== 1. 打开订单管理 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`录入页前500字:\n${text.substring(0, 500)}`);
    await page.screenshot({ path: 'screenshots/e2ev2-1-entry.png', fullPage: true });

    // ====== 2. 填写订单编号 ======
    console.log('\n====== 2. 填写订单编号 ======');
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
    console.log(`表单输入框(排除搜索): ${formInputs.length}个`);
    if (formInputs.length >= 1) {
      await formInputs[0].fill('ORD-20260523-001');
      console.log('✓ 订单编号: ORD-20260523-001');
    }

    // ====== 3. 关联客户 ======
    console.log('\n====== 3. 关联客户 ======');

    // 查找所有可见按钮
    await dumpButtons(page, '填写订单编号后');

    const assocBtns = page.locator('button:has-text("关联数据")');
    const assocCount = await assocBtns.count();
    console.log(`"关联数据"按钮: ${assocCount}个`);
    for (let i = 0; i < assocCount; i++) {
      const btn = assocBtns.nth(i);
      const visible = await btn.isVisible().catch(() => false);
      console.log(`  [${i}] visible=${visible}`);
      if (visible) {
        await btn.click({ force: true });
        console.log(`✓ 已点击 [${i}]`);
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/e2ev2-2-modal-open.png', fullPage: true });
    await dumpButtons(page, '打开关联数据弹窗后');

    text = await readPage(page);
    console.log(`\n弹窗内容:\n${text.substring(0, 1000)}`);

    // 选中张三
    const rows = page.locator('tr:has-text("张三"), [class*="row"]:has-text("张三")');
    console.log(`含"张三"的行: ${await rows.count()}个`);
    if (await rows.count() > 0) {
      const row = rows.first();
      const cb = row.locator('input[type="checkbox"], input[type="radio"]').first();
      if (await cb.count() > 0 && await cb.isVisible().catch(() => false)) {
        await cb.click({ force: true });
        console.log('✓ 已勾选张三');
      } else {
        await row.click({ force: true });
        console.log('✓ 已点击张三行');
      }
      await page.waitForTimeout(500);
    }

    // 找并点击确定按钮
    const confirmBtns = page.locator('button:has-text("确定")');
    const cbCount = await confirmBtns.count();
    console.log(`\n"确定"按钮: ${cbCount}个`);
    for (let i = 0; i < cbCount; i++) {
      const btn = confirmBtns.nth(i);
      const visible = await btn.isVisible().catch(() => false);
      const text = await btn.innerText().catch(() => '');
      console.log(`  [${i}] text="${text}" visible=${visible}`);
    }

    if (cbCount > 0) {
      // 点最后一个可见的确定
      for (let i = cbCount - 1; i >= 0; i--) {
        const btn = confirmBtns.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true });
          console.log(`✓ 已点击确定[${i}]`);
          await page.waitForTimeout(2000);
          break;
        }
      }
    } else {
      // 尝试其他关闭方式
      console.log('没有"确定"按钮，尝试其他方式...');
      const okBtn = page.locator('button:has-text("确认"), button:has-text("OK"), button:has-text("好的")').first();
      if (await okBtn.count() > 0) await okBtn.click({ force: true });
      // 或者按Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    text = await readPage(page);
    const modalGone = !text.includes('数据标题') || text.includes('订单编号');
    console.log(`弹窗关闭: ${modalGone ? '✓' : '✗ 可能仍然打开'}`);

    // ====== 4. 选择产品 ======
    console.log('\n====== 4. 选择产品 ======');
    if (!modalGone) {
      // 弹窗可能还在，尝试按 Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'screenshots/e2ev2-3-after-customer.png', fullPage: true });
    await dumpButtons(page, '关联客户后');

    const chooseBtns = page.locator('button:has-text("选择数据")');
    console.log(`"选择数据"按钮: ${await chooseBtns.count()}个`);
    for (let i = 0; i < await chooseBtns.count(); i++) {
      const btn = chooseBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        console.log(`✓ 已点击选择数据 [${i}]`);
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/e2ev2-4-product-modal.png', fullPage: true });
    await dumpButtons(page, '选择数据弹窗');

    text = await readPage(page);
    console.log(`\n弹窗内容:\n${text.substring(0, 1000)}`);

    // 选中智能手机
    const prodRows = page.locator('tr:has-text("智能手机"), [class*="row"]:has-text("智能手机")');
    console.log(`含"智能手机"的行: ${await prodRows.count()}个`);
    if (await prodRows.count() > 0) {
      const row = prodRows.first();
      const cb = row.locator('input[type="checkbox"], input[type="radio"]').first();
      if (await cb.count() > 0 && await cb.isVisible().catch(() => false)) {
        await cb.click({ force: true });
        console.log('✓ 已勾选智能手机');
      } else {
        await row.click({ force: true });
        console.log('✓ 已点击智能手机行');
      }
      await page.waitForTimeout(500);
    }

    // 确定
    const confirmBtns2 = page.locator('button:has-text("确定")');
    const cb2Count = await confirmBtns2.count();
    console.log(`\n"确定"按钮: ${cb2Count}个`);
    if (cb2Count > 0) {
      for (let i = cb2Count - 1; i >= 0; i--) {
        const btn = confirmBtns2.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true });
          console.log(`✓ 已点击确定[${i}]`);
          await page.waitForTimeout(2000);
          break;
        }
      }
    } else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // ====== 5. 子表数据 ======
    console.log('\n====== 5. 子表数据 ======');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/e2ev2-5-before-subtable.png', fullPage: true });

    text = await readPage(page);
    console.log(`当前页面(前1500):\n${text.substring(0, 1500)}`);

    await dumpButtons(page, '填写子表前');

    // 搜索包含"订单明细"和"添加"的按钮
    const addInSubTable = page.locator('button:has-text("添加")').first();
    const addCount = await page.locator('button:has-text("添加")').count();
    console.log(`"添加"按钮: ${addCount}个`);
    for (let i = 0; i < addCount; i++) {
      const btn = page.locator('button:has-text("添加")').nth(i);
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        const nearby = await btn.locator('..').locator('..').innerText().catch(() => '').then(t => t.substring(0, 80));
        console.log(`  [${i}] nearby="${nearby}"`);
      }
    }

    // 尝试点击子表的添加按钮（通常在"订单明细"标题附近）
    if (addCount > 0) {
      // 对于关联子表，添加按钮可能在子表标题行
      const addBtn = page.locator('button:has-text("添加")').last();
      await addBtn.click({ force: true });
      console.log('✓ 已点击添加(最后一个)');
      await page.waitForTimeout(2000);
    }

    text = await readPage(page);
    console.log(`\n点击添加后:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/e2ev2-6-subtable-row.png', fullPage: true });

    // 填写子表行数据 - 查找新增的输入框
    const allInputs2 = page.locator('input.input-inner:not([readonly])');
    const ac2 = await allInputs2.count();
    console.log(`所有可编辑输入框: ${ac2}个`);
    for (let i = 0; i < Math.min(ac2, 10); i++) {
      const inp = allInputs2.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      console.log(`  [${i}] value="${val}" ph="${ph}"`);
    }

    // 子表输入框通常是新出现的，跳过主表已有的
    // 策略：用不同的值填充，先看哪些是空的
    const subInputs: any[] = [];
    for (let i = 0; i < ac2; i++) {
      const inp = allInputs2.nth(i);
      const val = await inp.inputValue().catch(() => '');
      if (!val) subInputs.push(inp);
    }
    console.log(`空输入框: ${subInputs.length}个`);

    if (subInputs.length >= 4) {
      await subInputs[0].fill('智能手机');
      await subInputs[1].fill('2');
      await subInputs[2].fill('2999');
      await subInputs[3].fill('5998');
      console.log('✓ 子表数据已填写');
    } else if (subInputs.length > 0) {
      // 按顺序填写可用的
      const fillValues = ['智能手机', '2', '2999', '5998'];
      for (let i = 0; i < Math.min(subInputs.length, fillValues.length); i++) {
        await subInputs[i].fill(fillValues[i]);
      }
      console.log(`✓ 已填写${Math.min(subInputs.length, fillValues.length)}个子表字段`);
    }

    // 确认子表行（如果有确定/保存按钮）
    const subSave = page.locator('button:has-text("确定"), button:has-text("保存")').last();
    if (await subSave.count() > 0 && await subSave.isVisible().catch(() => false)) {
      const saveText = await subSave.innerText().catch(() => '');
      if (saveText === '确定' || saveText === '保存') {
        await subSave.click({ force: true });
        console.log(`✓ 已点击${saveText}`);
        await page.waitForTimeout(1000);
      }
    }

    // ====== 6. 提交 ======
    console.log('\n====== 6. 提交 ======');
    await page.screenshot({ path: 'screenshots/e2ev2-7-before-submit.png', fullPage: true });
    text = await readPage(page);
    console.log(`提交前(前1500):\n${text.substring(0, 1500)}`);

    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已点击提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`\n提交后:\n${text.substring(0, 600)}`);
    await page.screenshot({ path: 'screenshots/e2ev2-8-result.png', fullPage: true });

    console.log('\n====== E2E V2 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
