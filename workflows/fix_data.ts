/**
 * 重新提交正确数据 - 跳过搜索框(input[0])，从input[1]开始填表单字段
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

async function goHome(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2500);
}

async function main() {
  console.log('[FIX DATA] 提交正确数据\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    // ====== 1. 删除旧的错误数据 ======
    console.log('====== 1. 删除旧数据 ======');

    for (const formName of ['客户信息', '产品信息', '订单管理']) {
      console.log(`\n清理 ${formName}...`);
      await goHome(page);
      await page.locator('.tree-node').filter({ hasText: formName }).first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      let text = await readPage(page);

      // 如果显示的是表单录入页，切换到数据管理
      if (text.includes('提交') && !text.includes('批量操作')) {
        // 点"数据管理"按钮
        const dataMgmtBtn = page.locator('button:has-text("数据管理")').first();
        if (await dataMgmtBtn.count() > 0) {
          await dataMgmtBtn.click({ force: true });
          await page.waitForTimeout(3000);
          await waitForStableDOM(page);
        }
      }

      text = await readPage(page);
      console.log(`  页面: ${text.includes('批量操作') ? '数据管理视图' : '其他'}`);

      // 全选checkbox
      const selectAll = page.locator('[class*="table-header"] input[type="checkbox"], thead input[type="checkbox"]').first();
      if (await selectAll.count() > 0 && await selectAll.isVisible().catch(() => false)) {
        await selectAll.click({ force: true });
        await page.waitForTimeout(500);
        console.log('  ✓ 已全选');
      }

      // 点删除
      const deleteBtn = page.locator('button:has-text("删除"), span:has-text("删除")').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(1000);

        const alertText = await page.locator('[class*="alert"], [class*="dialog"]').first().innerText().catch(() => '');
        console.log(`  删除确认: ${alertText.substring(0, 200).replace(/\n/g, ' ')}`);

        if (alertText.includes('确定') || alertText.includes('删除')) {
          const confirmBtn = page.locator('[class*="alert"] button:has-text("确定"), [class*="dialog"] button:has-text("确定")').last();
          if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click({ force: true });
            console.log('  ✓ 已删除旧数据');
            await page.waitForTimeout(2000);
          }
        }
      }
    }

    // ====== 2. 重新提交客户数据 ======
    console.log('\n====== 2. 提交客户数据 ======');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '客户信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`页面: ${text.substring(0, 300)}`);

    // 如果在数据管理页，回到表单录入页
    if (text.includes('批量操作')) {
      // 找"添加"按钮
      const addBtn = page.locator('button:has-text("添加")').first();
      if (await addBtn.count() > 0) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);
      }
    }

    text = await readPage(page);
    console.log(`表单: ${text.substring(0, 300)}`);

    // 重要：跳过input[0]（搜索框），从input[1]开始
    const allInputs = page.locator('input.input-inner:not([readonly])');
    const allCount = await allInputs.count();
    console.log(`全部input: ${allCount}个`);

    // 找到真正的表单字段（不是搜索框的那些）
    // 搜索框的placeholder包含"搜索"
    const formInputs: any[] = [];
    for (let i = 0; i < allCount; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) {
        formInputs.push(inp);
      }
    }
    console.log(`表单字段input: ${formInputs.length}个`);

    if (formInputs.length >= 1) await formInputs[0].fill('张三');
    if (formInputs.length >= 2) await formInputs[1].fill('13800138000');
    if (formInputs.length >= 3) await formInputs[2].fill('VIP');
    if (formInputs.length >= 4) await formInputs[3].fill('上海市浦东新区');
    console.log('✓ 客户数据已填写');

    await page.screenshot({ path: 'screenshots/cust-correct.png', fullPage: true });

    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click({ force: true });
      console.log('✓ 客户数据已提交');
      await page.waitForTimeout(3000);
    }

    // ====== 3. 重新提交产品数据 ======
    console.log('\n====== 3. 提交产品数据 ======');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '产品信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    if (text.includes('批量操作')) {
      const addBtn = page.locator('button:has-text("添加")').first();
      if (await addBtn.count() > 0) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);
      }
    }

    // 过滤掉搜索框
    const prodAllInputs = page.locator('input.input-inner:not([readonly])');
    const paCount = await prodAllInputs.count();
    const prodFormInputs: any[] = [];
    for (let i = 0; i < paCount; i++) {
      const inp = prodAllInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) {
        prodFormInputs.push(inp);
      }
    }
    console.log(`产品表单字段: ${prodFormInputs.length}个`);
    for (let i = 0; i < prodFormInputs.length; i++) {
      const ph = await prodFormInputs[i].getAttribute('placeholder').catch(() => '');
      console.log(`  [${i}] placeholder="${ph}"`);
    }

    if (prodFormInputs.length >= 1) await prodFormInputs[0].fill('智能手机');
    if (prodFormInputs.length >= 2) await prodFormInputs[1].fill('标准版');
    if (prodFormInputs.length >= 3) await prodFormInputs[2].fill('2999');
    if (prodFormInputs.length >= 4) await prodFormInputs[3].fill('100');
    if (prodFormInputs.length >= 5) await prodFormInputs[4].fill('P001');
    console.log('✓ 产品数据已填写');

    await page.screenshot({ path: 'screenshots/prod-correct.png', fullPage: true });

    const prodSubmitBtn = page.locator('button:has-text("提交")').first();
    if (await prodSubmitBtn.count() > 0) {
      await prodSubmitBtn.click({ force: true });
      console.log('✓ 产品数据已提交');
      await page.waitForTimeout(3000);
    }

    // ====== 4. 重新提交订单数据 ======
    console.log('\n====== 4. 提交订单数据 ======');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    if (text.includes('批量操作')) {
      const addBtn = page.locator('button:has-text("添加")').first();
      if (await addBtn.count() > 0) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);
      }
    }

    // 过滤搜索框
    const orderAllInputs = page.locator('input.input-inner:not([readonly])');
    const oaCount = await orderAllInputs.count();
    const orderFormInputs: any[] = [];
    for (let i = 0; i < oaCount; i++) {
      const inp = orderAllInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!ph || !ph.includes('搜索')) {
        orderFormInputs.push(inp);
      }
    }
    console.log(`订单表单字段: ${orderFormInputs.length}个`);

    // 填订单编号
    if (orderFormInputs.length >= 1) {
      await orderFormInputs[0].fill('ORD-20260522-001');
      console.log('✓ 已填写订单编号');
    }

    // 选择关联客户
    console.log('\n选择关联客户...');
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) {
      await assocBtn.click({ force: true });
      await page.waitForTimeout(3000);

      text = await readPage(page);
      console.log(`关联弹窗:\n${text.substring(0, 500)}`);

      // 选择数据行 - 找包含"张三"的行或其checkbox
      const row = page.locator('[class*="table-body"] [class*="row"]:has-text("张三"), tr:has-text("张三")').first();
      if (await row.count() > 0) {
        const cb = row.locator('input[type="checkbox"], input[type="radio"]').first();
        if (await cb.count() > 0) {
          await cb.click({ force: true });
        } else {
          await row.click({ force: true });
        }
        console.log('✓ 已选择客户');
      }

      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1500);
      }
    }

    // 选择产品
    console.log('\n选择产品...');
    const chooseBtn = page.locator('button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0) {
      await chooseBtn.click({ force: true });
      await page.waitForTimeout(3000);

      text = await readPage(page);
      console.log(`选择数据弹窗:\n${text.substring(0, 500)}`);

      const row = page.locator('[class*="table-body"] [class*="row"]:has-text("智能手机"), tr:has-text("智能手机")').first();
      if (await row.count() > 0) {
        const cb = row.locator('input[type="checkbox"], input[type="radio"]').first();
        if (await cb.count() > 0) {
          await cb.click({ force: true });
        } else {
          await row.click({ force: true });
        }
        console.log('✓ 已选择产品');
      }

      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1500);
      }
    }

    await page.screenshot({ path: 'screenshots/order-correct.png', fullPage: true });

    // 提交
    text = await readPage(page);
    console.log(`\n提交前:\n${text.substring(0, 500)}`);

    const orderSubmitBtn = page.locator('button:has-text("提交")').first();
    if (await orderSubmitBtn.count() > 0) {
      await orderSubmitBtn.click({ force: true });
      console.log('✓ 订单已提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`提交后:\n${text.substring(0, 300)}`);

    // ====== 5. 最终验证数据管理视图 ======
    console.log('\n====== 5. 最终验证 ======');
    for (const formName of ['客户信息', '产品信息', '订单管理']) {
      await goHome(page);
      await page.locator('.tree-node').filter({ hasText: formName }).first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      text = await readPage(page);
      if (!text.includes('批量操作')) {
        const dataMgmt = page.locator('button:has-text("数据管理")').first();
        if (await dataMgmt.count() > 0) {
          await dataMgmt.click({ force: true });
          await page.waitForTimeout(3000);
          await waitForStableDOM(page);
        }
      }

      text = await readPage(page);
      // 提取表格核心数据
      const idx = text.indexOf('提交人');
      if (idx >= 0) {
        const dataArea = text.substring(idx, idx + 300).replace(/\n/g, ' | ');
        console.log(`\n${formName}:\n  ${dataArea}`);
      }
    }

    console.log('\n====== 全部数据修复完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
