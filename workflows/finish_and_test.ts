/**
 * 完成剩余任务：
 * 1. 删除未命名表单
 * 2. 填写提交测试数据（订单管理已经在数据录入页）
 * 3. 通过编辑器顶部tab找表单发布入口
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
  console.log('[FINISH & TEST]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    let text = await readPage(page);

    // ====== 1. 删除未命名表单 ======
    console.log('====== 1. 删除未命名表单 ======');
    const unnamedEntry = page.locator('.tree-node').filter({ hasText: '未命名表单' }).first();
    if (await unnamedEntry.count() > 0 && await unnamedEntry.isVisible().catch(() => false)) {
      await unnamedEntry.hover({ force: true });
      await page.waitForTimeout(600);
      await unnamedEntry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);

      const deleteItem = page.locator('li:has-text("删除")').last();
      if (await deleteItem.count() > 0) {
        await deleteItem.click({ force: true });
        await page.waitForTimeout(1000);

        const alertText = await page.locator('[class*="x-alert"]').first().innerText().catch(() => '');
        console.log(`弹窗: ${alertText.substring(0, 200).replace(/\n/g, ' ')}`);

        if (alertText.includes('确定要删除')) {
          await page.waitForTimeout(3000); // 等倒计时
          const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
          await delBtn.click({ force: true }).catch(() => {});
          console.log('✓ 已删除未命名表单');
          await page.waitForTimeout(2000);
        } else {
          await page.locator('button:has-text("我知道了")').last().click({ force: true }).catch(() => {});
        }
      }
    } else {
      console.log('未找到未命名表单（可能已删除）');
    }

    // ====== 2. 填写提交订单数据 ======
    console.log('\n====== 2. 填写提交订单数据 ======');
    await goHome(page);

    // 点击进入订单管理的表单
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`订单管理页面:\n${text.substring(0, 600)}`);

    // 直接填写表单
    // 找订单编号输入框
    const inputs = page.locator('input.input-inner:not([readonly])');
    const inputCount = await inputs.count();
    console.log(`\n输入框数量: ${inputCount}`);

    // 填写订单编号
    if (inputCount >= 1) {
      await inputs.nth(0).click({ clickCount: 3, force: true });
      await inputs.nth(0).fill('ORD-20260522-001');
      console.log('✓ 已填写订单编号');
    }

    // 点击关联数据按钮选择客户
    console.log('\n--- 选择关联客户 ---');
    const assocBtn = page.locator('button.data-select-btn:has-text("关联数据"), button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0 && await assocBtn.isVisible().catch(() => false)) {
      await assocBtn.click({ force: true });
      await page.waitForTimeout(2500);

      text = await readPage(page);
      console.log(`关联选择弹窗:\n${text.substring(0, 500)}`);

      // 查找并选择客户数据
      const firstRecord = page.locator('tr:has-text("张"), [class*="row"]:has-text("张")').first();
      if (await firstRecord.count() > 0 && await firstRecord.isVisible().catch(() => false)) {
        // 点该行的checkbox或行本身
        const checkbox = firstRecord.locator('[class*="checkbox"], input[type="checkbox"], input[type="radio"]').first();
        if (await checkbox.count() > 0) {
          await checkbox.click({ force: true });
        } else {
          await firstRecord.click({ force: true });
        }
        console.log('✓ 已选择客户');
        await page.waitForTimeout(500);
      } else {
        console.log('未找到客户数据，可能客户信息还没有数据');
        console.log(`完整弹窗文本:\n${text.substring(0, 1500)}`);
      }

      // 点确定关闭弹窗
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // 点击选择数据按钮选择产品
    console.log('\n--- 选择产品 ---');
    const chooseBtn = page.locator('button.data-select-btn:has-text("选择数据"), button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0 && await chooseBtn.isVisible().catch(() => false)) {
      await chooseBtn.click({ force: true });
      await page.waitForTimeout(2500);

      text = await readPage(page);
      console.log(`选择数据弹窗:\n${text.substring(0, 500)}`);

      const firstRecord = page.locator('tr:has-text("智能"), [class*="row"]:has-text("智能")').first();
      if (await firstRecord.count() > 0 && await firstRecord.isVisible().catch(() => false)) {
        const checkbox = firstRecord.locator('[class*="checkbox"], input[type="checkbox"], input[type="radio"]').first();
        if (await checkbox.count() > 0) {
          await checkbox.click({ force: true });
        } else {
          await firstRecord.click({ force: true });
        }
        console.log('✓ 已选择产品');
        await page.waitForTimeout(500);
      }

      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // 填写下单日期（如果有日期输入框）
    const dateInput = page.locator('input[placeholder*="日期"], .datetime input, [class*="date"] input').first();
    if (await dateInput.count() > 0 && await dateInput.isVisible().catch(() => false)) {
      await dateInput.click({ force: true });
      await dateInput.fill('2026-05-22');
      await page.waitForTimeout(500);
    }

    // 截图看看填写后的表单
    await page.screenshot({ path: 'screenshots/order-form-filled.png', fullPage: true });
    text = await readPage(page);
    console.log(`\n填写后表单:\n${text.substring(0, 800)}`);

    // 提交
    console.log('\n--- 提交订单 ---');
    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 订单已提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    console.log(`提交后:\n${text.substring(0, 500)}`);

    // ====== 3. 尝试设置权限 - 通过编辑器找表单发布入口 ======
    console.log('\n====== 3. 设置权限 ======');

    // 方法：进入编辑器，找顶部按钮
    await goHome(page);
    const orderEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await orderEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 读编辑器页面
    text = await readPage(page);
    console.log(`编辑器页面:\n${text.substring(0, 1000)}`);

    // 找表单发布入口 - 编辑器顶部可能有tab
    // 可能在顶部导航中
    const topButtons = await page.$$eval('button, a, [class*="tab"], [class*="nav"]', els =>
      els.filter(el => el.offsetHeight > 0).map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().substring(0, 50),
        class: ((el as HTMLElement).className || '').substring(0, 80),
      }))
    );
    console.log(`\n编辑器顶部元素:`);
    topButtons.forEach((b, i) => {
      if (b.text) console.log(`  [${i}] ${b.tag} "${b.text}" class="${b.class}"`);
    });

    // 查找"表单发布"相关
    const publishTab = page.locator('[class*="tab"]:has-text("发布"), button:has-text("表单发布"), [class*="tab"]:has-text("表单发布")').first();
    if (await publishTab.count() > 0) {
      console.log(`\n找到表单发布入口: "${await publishTab.innerText().catch(() => '')}"`);
    } else {
      // 看看有没有"发布"按钮在顶部
      const publishBtn = page.locator('button:has-text("发布"), [class*="publish"], text=发布').first();
      if (await publishBtn.count() > 0) {
        console.log(`找到发布相关: "${await publishBtn.innerText().catch(() => '')}"`);
      }
    }

    await page.screenshot({ path: 'screenshots/editor-top.png', fullPage: true });

    // ====== 4. 也到客户信息和产品信息添加测试数据 ======
    // 先回首页添加客户
    console.log('\n====== 4. 添加客户和产品数据 ======');
    await goHome(page);

    // 客户信息
    console.log('\n--- 客户信息 ---');
    await page.locator('.tree-node').filter({ hasText: '客户信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`客户信息页面:\n${text.substring(0, 400)}`);

    // 尝试添加数据
    if (text.includes('提交') && text.includes('客户名称')) {
      console.log('  已显示数据录入表单，直接填写...');
      const custInputs = page.locator('input.input-inner:not([readonly])');
      const ciCount = await custInputs.count();
      console.log(`  输入框: ${ciCount}个`);
      if (ciCount >= 1) await custInputs.nth(0).fill('张三');
      if (ciCount >= 2) await custInputs.nth(1).fill('13800138000');

      const submit = page.locator('button:has-text("提交")').first();
      if (await submit.count() > 0) {
        await submit.click({ force: true });
        console.log('  ✓ 客户数据已提交');
        await page.waitForTimeout(2000);
      }
    }

    // 产品信息
    console.log('\n--- 产品信息 ---');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '产品信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`产品信息页面:\n${text.substring(0, 400)}`);

    if (text.includes('提交') && text.includes('产品名称')) {
      console.log('  已显示数据录入表单，直接填写...');
      const prodInputs = page.locator('input.input-inner:not([readonly])');
      const piCount = await prodInputs.count();
      console.log(`  输入框: ${piCount}个`);
      if (piCount >= 1) await prodInputs.nth(0).fill('智能手机');
      if (piCount >= 2) await prodInputs.nth(1).fill('标准版');
      if (piCount >= 3) await prodInputs.nth(2).fill('2999');
      if (piCount >= 4) await prodInputs.nth(3).fill('100');
      if (piCount >= 5) await prodInputs.nth(4).fill('P001');

      await page.screenshot({ path: 'screenshots/prod-form-filled.png', fullPage: true });

      const submit = page.locator('button:has-text("提交")').first();
      if (await submit.count() > 0) {
        await submit.click({ force: true });
        console.log('  ✓ 产品数据已提交');
        await page.waitForTimeout(2000);
      }
    }

    // ====== 最终验证 ======
    await page.screenshot({ path: 'screenshots/final-complete.png', fullPage: true });
    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
