/**
 * 修复关联子表：重新绑定到存活的订单明细表
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
  console.log('[FIX SUBTABLE]\n');
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

    // ====== Step 1: 删除旧的失效关联子表字段 ======
    console.log('====== Step 1: 删除失效的关联子表字段 ======');
    const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();

    // 点击选中
    await subField.click({ force: true });
    await page.waitForTimeout(600);

    // 点删除按钮
    const deleteBtn = subField.locator('.btn-delete.btn-trash, i[title="删除"]').first();
    if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click({ force: true });
      console.log('✓ 已点击删除');
      await page.waitForTimeout(1000);

      const confirmBtn = page.locator('[class*="alert"] button:has-text("确定"), [class*="alert"] button:has-text("删除")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        console.log('✓ 已确认删除');
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('尝试直接点击...');
      await deleteBtn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(1000);
    }

    // ====== Step 2: 保存后再重新添加 ======
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    console.log('\n====== Step 2: 重新添加关联子表 ======');

    // 从左侧添加关联子表
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 设标题
    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    let text = await readPage(page);
    console.log(`关联子表属性面板:\n${text.substring(0, 1500)}`);

    // 找关联表下拉 - "表单已删除"的那个
    const allDDs = page.locator('.x-biz-dropdown-label');
    const ddCount = await allDDs.count();
    console.log(`\n属性面板dropdown: ${ddCount}个`);

    for (let i = 0; i < ddCount; i++) {
      const dd = allDDs.nth(i);
      const ddVisible = await dd.isVisible().catch(() => false);
      const ddText = await dd.innerText().catch(() => '');
      if (ddVisible) {
        console.log(`  [${i}] "${ddText.substring(0, 50)}"`);
      }
    }

    // 找到"关联表"相关的下拉（可能是空或显示"请选择关联表"）
    // 或者找有"从空白新建"的选项
    // 先尝试点"从空白新建"
    const createBlankBtn = page.locator('text=从空白新建').first();
    if (await createBlankBtn.count() > 0 && await createBlankBtn.isVisible().catch(() => false)) {
      console.log('\n从空白新建...');
      await createBlankBtn.click({ force: true });
      await page.waitForTimeout(1000);

      // 输入表名
      const formNameInput = page.locator('[class*="dialog"] input.input-inner, input.input-inner').first();
      if (await formNameInput.count() > 0) {
        await formNameInput.click({ clickCount: 3, force: true });
        await formNameInput.fill('订单明细表');
        await page.waitForTimeout(300);

        const designBtn = page.locator('button:has-text("设计关联表")').first();
        if (await designBtn.count() > 0) {
          await designBtn.click({ force: true });
          console.log('✓ 已从空白新建订单明细表');
          await page.waitForTimeout(3000);
        }
      }
    } else {
      // 可能没有"从空白新建"，需要点开下拉选现有表单
      console.log('\n尝试选择现有订单明细表...');

      // 点开关联表下拉
      for (let i = 0; i < ddCount; i++) {
        const dd = allDDs.nth(i);
        const ddVisible = await dd.isVisible().catch(() => false);
        const ddText = await dd.innerText().catch(() => '');

        if (ddVisible && (ddText.includes('已删除') || ddText.trim() === '' || ddText.includes('请选择'))) {
          await dd.click({ force: true });
          await page.waitForTimeout(1000);
          console.log(`  已点开dropdown[${i}]`);

          text = await readPage(page);
          console.log(`  下拉内容:\n  ${text.substring(0, 1200).replace(/\n/g, '\n  ')}`);

          // 选"订单明细表"
          const orderDetailOpt = page.locator('[class*="option"]:has-text("订单明细表"), li:has-text("订单明细表")').first();
          if (await orderDetailOpt.count() > 0 && await orderDetailOpt.isVisible().catch(() => false)) {
            await orderDetailOpt.click({ force: true });
            console.log('  ✓ 已选择订单明细表');
            await page.waitForTimeout(500);
          } else {
            // 尝试文本点击
            await page.locator('text=订单明细表').last().click({ force: true }).catch(() => {});
            console.log('  尝试文本点击订单明细表');
            await page.waitForTimeout(500);
          }
          break;
        }
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== Step 3: 验证修复结果 ======
    console.log('\n====== Step 3: 验证修复 ======');

    // 重新进入编辑器确认
    text = await readPage(page);
    const subFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        return label;
      })
    );
    console.log(`画布字段: ${subFields.join(' | ')}`);

    // 点击订单明细字段看属性
    const newSubField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await newSubField.count() > 0) {
      await newSubField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      console.log(`属性面板:\n${text.substring(text.indexOf('标题'), text.indexOf('标题') + 600)}`);

      if (text.includes('订单明细表') && !text.includes('已删除')) {
        console.log('✓ 关联子表已正确绑定到订单明细表！');
      } else {
        console.log('⚠ 可能仍有问题');
      }
    }

    // ====== Step 4: 提交测试订单验证子表功能 ======
    console.log('\n====== Step 4: 提交测试订单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`录入页:\n${text}`);

    // 填订单编号（跳过搜索框）
    const allInputs = page.locator('input.input-inner:not([readonly])');
    const ac = await allInputs.count();
    const formInputs: any[] = [];
    for (let i = 0; i < ac; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) {
        formInputs.push(inp);
      }
    }
    if (formInputs.length >= 1) await formInputs[0].fill('ORD-20260522-003');

    // 选择关联客户
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) {
      await assocBtn.click({ force: true });
      await page.waitForTimeout(2500);
      const row = page.locator('[class*="table-body"] [class*="row"]:has-text("张三"), tr:has-text("张三")').first();
      if (await row.count() > 0) {
        const cb = row.locator('input[type="checkbox"], input[type="radio"]').first();
        if (await cb.count() > 0) await cb.click({ force: true });
        else await row.click({ force: true });
      }
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // 选择产品
    const chooseBtn = page.locator('button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0) {
      await chooseBtn.click({ force: true });
      await page.waitForTimeout(2500);
      const row = page.locator('[class*="table-body"] [class*="row"]:has-text("智能手机"), tr:has-text("智能手机")').first();
      if (await row.count() > 0) {
        const cb = row.locator('input[type="checkbox"], input[type="radio"]').first();
        if (await cb.count() > 0) await cb.click({ force: true });
        else await row.click({ force: true });
      }
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // 找子表添加按钮
    text = await readPage(page);
    console.log(`\n填完关联后:\n${text.substring(0, 800)}`);

    // 子表应该显示"订单明细"和一个"添加"链接
    const allAddLinks = page.locator('[class*="link-table"]:has-text("添加"), a:has-text("添加"), span:has-text("添加")');
    const addCount = await allAddLinks.count();
    console.log(`"添加"元素: ${addCount}个`);

    for (let i = 0; i < Math.min(addCount, 10); i++) {
      const el = allAddLinks.nth(i);
      const elText = await el.innerText().catch(() => '');
      const elTag = await el.evaluate(e => e.tagName).catch(() => '');
      const elVisible = await el.isVisible().catch(() => false);
      console.log(`  [${i}] ${elTag} "${elText}" visible=${elVisible}`);
    }

    await page.screenshot({ path: 'screenshots/subtable-final.png', fullPage: true });

    // 提交
    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click({ force: true });
      console.log('✓ 订单已提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`提交结果: ${text.substring(0, 200)}`);

    console.log('\n====== 关联子表修复完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
