/**
 * 按照正确顺序添加测试数据：
 * 1. 客户数据
 * 2. 产品数据
 * 3. 订单数据（关联客户+选择产品）
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
  console.log('[ADD DATA]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    let text = await readPage(page);
    console.log(`应用首页表单: ${text.substring(0, 200)}`);

    // ====== 1. 添加客户数据 ======
    console.log('\n====== 1. 添加客户数据 ======');
    await page.locator('.tree-node').filter({ hasText: '客户信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`页面内容:\n${text.substring(0, 500)}`);

    // 页面似乎直接显示表单，找到输入框
    const custInputs = page.locator('input.input-inner:not([readonly])');
    const ciCount = await custInputs.count();
    console.log(`\n可见输入框: ${ciCount}个`);
    for (let i = 0; i < Math.min(ciCount, 10); i++) {
      const ph = await custInputs.nth(i).getAttribute('placeholder').catch(() => '');
      const val = await custInputs.nth(i).inputValue().catch(() => '');
      console.log(`  [${i}] value="${val}" placeholder="${ph}"`);
    }

    // 检查页面上有没有"提交"按钮，判断是否在数据录入页
    const hasSubmit = text.includes('提交');
    console.log(`\n在数据录入页: ${hasSubmit}`);

    if (hasSubmit && ciCount > 0) {
      await custInputs.nth(0).click({ clickCount: 3, force: true });
      await custInputs.nth(0).fill('张三');
      console.log('  ✓ 客户名称: 张三');

      if (ciCount > 1) {
        await custInputs.nth(1).click({ clickCount: 3, force: true });
        await custInputs.nth(1).fill('13800138000');
        console.log('  ✓ 联系电话: 13800138000');
      }

      if (ciCount > 2) {
        await custInputs.nth(2).click({ clickCount: 3, force: true });
        await custInputs.nth(2).fill('VIP');
        console.log('  ✓ 客户等级: VIP');
      }

      if (ciCount > 3) {
        await custInputs.nth(3).click({ clickCount: 3, force: true });
        await custInputs.nth(3).fill('上海市浦东新区');
        console.log('  ✓ 地址: 上海市浦东新区');
      }

      await page.screenshot({ path: 'screenshots/cust-filled.png', fullPage: true });

      const submitBtn = page.locator('button:has-text("提交")').first();
      if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click({ force: true });
        console.log('  ✓ 客户数据已提交');
        await page.waitForTimeout(3000);
      }
    } else {
      console.log('页面可能不是数据录入表单');
      // 看看有没有数据列表视图，可能需要点"新建"
      const addBtn = page.locator('button:has-text("新建"), button:has-text("添加数据")').first();
      if (await addBtn.count() > 0) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);
        // ...同上
      }
    }

    // ====== 2. 添加产品数据 ======
    console.log('\n====== 2. 添加产品数据 ======');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '产品信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`页面内容:\n${text.substring(0, 500)}`);

    const prodInputs = page.locator('input.input-inner:not([readonly])');
    const piCount = await prodInputs.count();
    console.log(`可见输入框: ${piCount}个`);
    for (let i = 0; i < Math.min(piCount, 10); i++) {
      const ph = await prodInputs.nth(i).getAttribute('placeholder').catch(() => '');
      console.log(`  [${i}] placeholder="${ph}"`);
    }

    if (text.includes('提交') && piCount > 0) {
      await prodInputs.nth(0).click({ clickCount: 3, force: true });
      await prodInputs.nth(0).fill('智能手机');
      console.log('  ✓ 产品名称: 智能手机');

      if (piCount > 1) {
        await prodInputs.nth(1).click({ clickCount: 3, force: true });
        await prodInputs.nth(1).fill('标准版');
        console.log('  ✓ 规格型号: 标准版');
      }

      if (piCount > 2) {
        await prodInputs.nth(2).click({ clickCount: 3, force: true });
        await prodInputs.nth(2).fill('2999');
        console.log('  ✓ 单价: 2999');
      }

      if (piCount > 3) {
        await prodInputs.nth(3).click({ clickCount: 3, force: true });
        await prodInputs.nth(3).fill('100');
        console.log('  ✓ 库存数量: 100');
      }

      if (piCount > 4) {
        await prodInputs.nth(4).click({ clickCount: 3, force: true });
        await prodInputs.nth(4).fill('P001');
        console.log('  ✓ 产品编号: P001');
      }

      await page.screenshot({ path: 'screenshots/prod-filled.png', fullPage: true });

      const submitBtn = page.locator('button:has-text("提交")').first();
      if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click({ force: true });
        console.log('  ✓ 产品数据已提交');
        await page.waitForTimeout(3000);
      }
    }

    // ====== 3. 添加订单数据（现在有客户和产品数据了） ======
    console.log('\n====== 3. 添加订单数据 ======');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`订单页面:\n${text.substring(0, 400)}`);

    const orderInputs = page.locator('input.input-inner:not([readonly])');
    const oiCount = await orderInputs.count();
    console.log(`输入框: ${oiCount}个`);

    if (text.includes('提交') && oiCount > 0) {
      // 填订单编号
      await orderInputs.nth(0).click({ clickCount: 3, force: true });
      await orderInputs.nth(0).fill('ORD-20260522-001');
      console.log('✓ 订单编号: ORD-20260522-001');

      // 点击关联数据选客户
      console.log('\n--- 选择关联客户 ---');
      const assocBtn = page.locator('button:has-text("关联数据"), button.data-select-btn:has-text("关联")').first();
      if (await assocBtn.count() > 0) {
        await assocBtn.click({ force: true });
        await page.waitForTimeout(3000);

        text = await readPage(page);
        console.log(`关联弹窗:\n${text.substring(0, 600)}`);

        // 看看弹窗中有什么可以选择
        // 可能有一个表格列表
        const selectableRows = page.locator('[class*="row"]:not([class*="header"]), tr:not(:has(th))').first();
        if (await selectableRows.count() > 0) {
          const rowText = await selectableRows.innerText().catch(() => '');
          console.log(`  第一行: "${rowText.substring(0, 80)}"`);

          // 点该行的checkbox
          const checkbox = selectableRows.locator('[class*="checkbox"], input[type="checkbox"]').first();
          if (await checkbox.count() > 0) {
            await checkbox.click({ force: true });
          } else {
            await selectableRows.click({ force: true });
          }
          console.log('  ✓ 已选择客户');
          await page.waitForTimeout(500);
        }

        // 确定
        const confirmBtn = page.locator('button:has-text("确定")').last();
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click({ force: true });
          console.log('  ✓ 关联客户已确认');
          await page.waitForTimeout(1000);
        }
      }

      // 点击选择数据选产品
      console.log('\n--- 选择产品 ---');
      const chooseBtn = page.locator('button:has-text("选择数据"), button:has-text("选择产品")').first();
      if (await chooseBtn.count() > 0) {
        await chooseBtn.click({ force: true });
        await page.waitForTimeout(3000);

        text = await readPage(page);
        console.log(`选择数据弹窗:\n${text.substring(0, 600)}`);

        const selectableRows = page.locator('[class*="row"]:not([class*="header"]), tr:not(:has(th))').first();
        if (await selectableRows.count() > 0) {
          const rowText = await selectableRows.innerText().catch(() => '');
          console.log(`  第一行: "${rowText.substring(0, 80)}"`);

          const checkbox = selectableRows.locator('[class*="checkbox"], input[type="checkbox"]').first();
          if (await checkbox.count() > 0) {
            await checkbox.click({ force: true });
          } else {
            await selectableRows.click({ force: true });
          }
          console.log('  ✓ 已选择产品');
          await page.waitForTimeout(500);
        }

        const confirmBtn = page.locator('button:has-text("确定")').last();
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click({ force: true });
          console.log('  ✓ 选择产品已确认');
          await page.waitForTimeout(1000);
        }
      }

      await page.screenshot({ path: 'screenshots/order-filled-final.png', fullPage: true });

      // 提交订单
      console.log('\n--- 提交订单 ---');
      const submitBtn = page.locator('button:has-text("提交")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click({ force: true });
        console.log('✓ 订单已提交');
        await page.waitForTimeout(3000);
      }

      text = await readPage(page);
      console.log(`提交后:\n${text.substring(0, 500)}`);
    }

    // ====== 4. 尝试找权限设置入口 ======
    console.log('\n====== 4. 查找权限设置入口 ======');
    await goHome(page);

    // 进入订单管理的编辑器
    const orderEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry.hover({ force: true });
    await page.waitForTimeout(600);

    // 注意：不使用force click entry-set-icon，而是直接点开看看
    const icon = orderEntry.locator('.entry-set-icon');
    if (await icon.count() > 0) {
      // 有时图标不可见，试试直接用playwright调度点击
      try {
        await icon.click();
        await page.waitForTimeout(800);
      } catch {
        await icon.dispatchEvent('click');
        await page.waitForTimeout(800);
      }
    }

    // 看菜单
    text = await readPage(page);
    console.log(`菜单页面:\n${text.substring(0, 800)}`);

    // 如果有"编辑"，点进去
    const editItem = page.locator('li:has-text("编辑")').last();
    if (await editItem.count() > 0 && await editItem.isVisible().catch(() => false)) {
      await editItem.click({ force: true });
      await page.waitForURL('**/edit**', { timeout: 10000 });
      await waitForStableDOM(page);
      await page.waitForTimeout(3000);

      // 在编辑器顶部找"发布"或权限相关
      text = await readPage(page);
      console.log(`编辑器内容:\n${text.substring(0, 1500)}`);

      // 找所有tab
      const allTabs = await page.$$eval('[class*="tab"], [class*="nav-item"], [role="tab"]', els =>
        els.filter(el => el.offsetHeight > 0).map(el => ({
          text: (el.textContent || '').trim().substring(0, 50),
          class: ((el as HTMLElement).className || '').substring(0, 80),
        }))
      );
      console.log(`\n编辑器Tab/导航:`);
      allTabs.forEach((t, i) => console.log(`  [${i}] "${t.text}" class="${t.class}"`));

      await page.screenshot({ path: 'screenshots/editor-for-perm.png', fullPage: true });
    }

    console.log('\n====== 全部操作完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
