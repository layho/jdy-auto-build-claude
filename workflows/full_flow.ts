/**
 * 修复和完善：清理重复表单、设置权限、添加测试数据
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

async function closeDialogs(page: Page): Promise<void> {
  for (const text of ['取消', '我知道了']) {
    const btn = page.locator(`button:has-text("${text}")`).last();
    if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
}

async function main() {
  console.log('[FIX & COMPLETE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    // ====== 1. 查看并清理重复表单 ======
    console.log('====== 1. 清理重复表单 ======');
    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`现有表单: ${formNames.join(', ')}`);

    // 删除未命名表单
    const unnamedCount = formNames.filter(n => n === '未命名表单').length;
    if (unnamedCount > 0) {
      console.log(`\n删除 ${unnamedCount} 个未命名表单...`);
      for (let i = 0; i < unnamedCount; i++) {
        await goHome(page);
        const entry = page.locator('.tree-node').filter({ hasText: '未命名表单' }).first();
        if (await entry.count() === 0) break;
        await entry.hover({ force: true });
        await page.waitForTimeout(600);
        await entry.locator('.entry-set-icon').click({ force: true });
        await page.waitForTimeout(600);
        await page.locator('li:has-text("删除")').last().click({ force: true });
        await page.waitForTimeout(1000);

        const alertText = await page.locator('[class*="x-alert"]').first().innerText().catch(() => '');
        console.log(`  弹窗: ${alertText.replace(/\n/g, ' ').substring(0, 200)}`);

        if (alertText.includes('确定要删除')) {
          const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
          if (await delBtn.count() > 0) {
            await delBtn.click({ force: true });
            console.log('  ✓ 已删除');
            await page.waitForTimeout(2000);
          }
        } else if (alertText.includes('无法删除') || alertText.includes('被调用')) {
          await page.locator('button:has-text("我知道了")').last().click({ force: true });
          console.log('  无法删除（被引用）');
        }
      }
    }

    // 检查重复的订单明细表
    const detailCount = formNames.filter(n => n === '订单明细表').length;
    if (detailCount > 1) {
      console.log(`\n${detailCount} 个订单明细表，删除多余的...`);
      await goHome(page);
      // 删除第一个
      const entry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
      await entry.hover({ force: true });
      await page.waitForTimeout(600);
      await entry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);
      await page.locator('li:has-text("删除")').last().click({ force: true });
      await page.waitForTimeout(1000);

      const alertText = await page.locator('[class*="x-alert"]').first().innerText().catch(() => '');
      console.log(`  弹窗: ${alertText.replace(/\n/g, ' ').substring(0, 200)}`);

      if (alertText.includes('确定要删除')) {
        const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
        if (await delBtn.count() > 0) {
          await delBtn.click({ force: true });
          console.log('  ✓ 已删除');
          await page.waitForTimeout(2000);
        }
      } else {
        await page.locator('button:has-text("我知道了")').last().click({ force: true });
        console.log('  无法删除（可能被引用）');
      }
    }

    await goHome(page);
    const finalFormNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`清理后表单: ${finalFormNames.join(', ')}`);

    // ====== 2. 设置权限 ======
    console.log('\n====== 2. 设置权限 ======');

    for (const formName of ['客户信息', '产品信息', '订单管理', '订单明细表']) {
      console.log(`\n--- ${formName} ---`);
      await goHome(page);

      const entry = page.locator('.tree-node').filter({ hasText: formName }).first();
      if (await entry.count() === 0) {
        console.log('  未找到表单');
        continue;
      }

      // 打开表单发布
      await entry.hover({ force: true });
      await page.waitForTimeout(600);
      await entry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);

      const publishItem = page.locator('li:has-text("表单发布")').last();
      if (await publishItem.count() > 0 && await publishItem.isVisible().catch(() => false)) {
        await publishItem.click({ force: true });
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
      }

      let text = await readPage(page);
      console.log(`  页面包含齐妍娜: ${text.includes('齐妍娜')}`);
      if (text.includes('齐妍娜')) {
        console.log(`  权限状态: ${text.includes('管理全部数据') ? '管理全部数据 ✓' : '需要提升'}`);
      }

      await page.screenshot({ path: `screenshots/perm-${formName}.png`, fullPage: true });

      // 如果齐妍娜权限不是管理全部数据，需要修改
      if (text.includes('齐妍娜') && !text.includes('管理全部数据')) {
        console.log('  需要提升权限...');
        // 找齐妍娜行的权限下拉
        const qinaRow = page.locator('tr:has-text("齐妍娜"), [class*="row"]:has-text("齐妍娜"), .member-item:has-text("齐妍娜")').first();
        if (await qinaRow.count() > 0) {
          // 点击权限下拉
          const permDropdown = qinaRow.locator('.x-biz-dropdown-label, [class*="dropdown"]').first();
          if (await permDropdown.count() > 0) {
            await permDropdown.click({ force: true });
            await page.waitForTimeout(800);

            // 选管理全部数据
            const manageAll = page.locator('[class*="option"]:has-text("管理全部数据"), li:has-text("管理全部数据")').first();
            if (await manageAll.count() > 0 && await manageAll.isVisible().catch(() => false)) {
              await manageAll.click({ force: true });
              console.log('  ✓ 已选择管理全部数据');
              await page.waitForTimeout(500);

              // 确认
              const confirmBtn = page.locator('button:has-text("确定")').last();
              if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
                await confirmBtn.click({ force: true });
                console.log('  ✓ 权限已保存');
                await page.waitForTimeout(1000);
              }
            }
          }
        }
      } else if (!text.includes('齐妍娜')) {
        console.log('  需要添加成员...');
        // 添加成员流程
        const addMemberBtn = page.locator('button:has-text("添加成员"), span:has-text("添加成员")').first();
        if (await addMemberBtn.count() > 0 && await addMemberBtn.isVisible().catch(() => false)) {
          await addMemberBtn.click({ force: true });
          await page.waitForTimeout(1500);

          const searchInput = page.locator('[class*="dialog"] input[placeholder*="搜索"], [class*="member"] input').first();
          if (await searchInput.count() > 0) {
            await searchInput.fill('齐妍娜');
            await page.waitForTimeout(1500);

            // 选第一个checkbox
            const checkbox = page.locator('[class*="checkbox"]').first();
            if (await checkbox.count() > 0) {
              await checkbox.click({ force: true });
              await page.waitForTimeout(500);
            }
          }

          const confirmBtn = page.locator('button:has-text("确定")').last();
          if (await confirmBtn.count() > 0) {
            await confirmBtn.click({ force: true });
            await page.waitForTimeout(1500);
          }
        }
      }
    }

    // ====== 3. 添加测试数据 ======
    console.log('\n====== 3. 添加测试数据 ======');

    // --- 添加客户 ---
    console.log('\n--- 添加客户 ---');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '客户信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`客户页面: ${text.substring(0, 300).replace(/\n/g, ' ')}`);

    // 找添加/新建按钮
    const addCustBtn = page.locator('button:has-text("新建"), button:has-text("添加数据"), [class*="add-btn"]:has-text("添加")').first();
    if (await addCustBtn.count() > 0 && await addCustBtn.isVisible().catch(() => false)) {
      await addCustBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      text = await readPage(page);
      console.log(`添加表单: ${text.substring(0, 400).replace(/\n/g, ' ')}`);

      // 填写 - 找可见输入框
      const inputs = page.locator('input.input-inner:not([readonly])');
      const cnt = await inputs.count();
      console.log(`输入框: ${cnt}个`);
      if (cnt >= 1) await inputs.nth(0).fill('张三');
      if (cnt >= 2) await inputs.nth(1).fill('13800138000');
      if (cnt >= 3) await inputs.nth(2).fill('VIP');
      if (cnt >= 4) await inputs.nth(3).fill('上海市浦东新区');

      await page.screenshot({ path: 'screenshots/add-cust-form.png', fullPage: true });

      const submitBtn = page.locator('button:has-text("提交")').first();
      if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click({ force: true });
        console.log('  ✓ 客户已提交');
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('  未找到添加按钮');
    }

    // --- 添加产品 ---
    console.log('\n--- 添加产品 ---');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '产品信息' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`产品页面: ${text.substring(0, 300).replace(/\n/g, ' ')}`);

    const addProdBtn = page.locator('button:has-text("新建"), button:has-text("添加数据"), [class*="add-btn"]:has-text("添加")').first();
    if (await addProdBtn.count() > 0 && await addProdBtn.isVisible().catch(() => false)) {
      await addProdBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      text = await readPage(page);
      console.log(`添加表单: ${text.substring(0, 400).replace(/\n/g, ' ')}`);

      const inputs = page.locator('input.input-inner:not([readonly])');
      const cnt = await inputs.count();
      console.log(`输入框: ${cnt}个`);
      if (cnt >= 1) await inputs.nth(0).fill('智能手机');
      if (cnt >= 2) await inputs.nth(1).fill('标准版');
      if (cnt >= 3) await inputs.nth(2).fill('2999');
      if (cnt >= 4) await inputs.nth(3).fill('100');
      if (cnt >= 5) await inputs.nth(4).fill('P001');

      await page.screenshot({ path: 'screenshots/add-prod-form.png', fullPage: true });

      const submitBtn = page.locator('button:has-text("提交")').first();
      if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click({ force: true });
        console.log('  ✓ 产品已提交');
        await page.waitForTimeout(2000);
      }
    }

    // --- 添加订单 ---
    console.log('\n--- 添加订单 ---');
    await goHome(page);
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`订单管理页面: ${text.substring(0, 400).replace(/\n/g, ' ')}`);

    const addOrderBtn = page.locator('button:has-text("新建"), button:has-text("添加数据"), [class*="add-btn"]:has-text("添加")').first();
    if (await addOrderBtn.count() > 0 && await addOrderBtn.isVisible().catch(() => false)) {
      await addOrderBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      text = await readPage(page);
      console.log(`订单表单完整内容:\n${text}`);
      await page.screenshot({ path: 'screenshots/add-order-form.png', fullPage: true });

      // 填写订单编号
      const inputs = page.locator('input.input-inner:not([readonly])');
      const cnt = await inputs.count();
      console.log(`\n输入框: ${cnt}个`);
      for (let i = 0; i < Math.min(cnt, 10); i++) {
        const inp = inputs.nth(i);
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        console.log(`  [${i}] placeholder="${ph}"`);
      }
      if (cnt >= 1) await inputs.nth(0).fill('ORD-20260522-001');

      // 点击关联数据按钮选择客户
      const lookupBtns = page.locator('button.data-select-btn, button:has-text("关联数据")');
      const lbCount = await lookupBtns.count();
      console.log(`\n数据选择按钮: ${lbCount}个`);
      for (let i = 0; i < lbCount; i++) {
        const btn = lookupBtns.nth(i);
        const btnText = await btn.innerText().catch(() => '');
        console.log(`  [${i}] "${btnText}"`);
      }

      // 点击关联客户选择
      const assocBtn = page.locator('button:has-text("关联数据")').first();
      if (await assocBtn.count() > 0 && await assocBtn.isVisible().catch(() => false)) {
        await assocBtn.click({ force: true });
        console.log('  点击关联数据...');
        await page.waitForTimeout(2000);
        text = await readPage(page);
        console.log(`  关联弹窗: ${text.substring(0, 500).replace(/\n/g, ' ')}`);
        await page.screenshot({ path: 'screenshots/lookup-dialog.png', fullPage: true });
      }

    } else {
      console.log('  未找到添加按钮');
      await page.screenshot({ path: 'screenshots/order-page.png', fullPage: true });
    }

    // ====== 最终截图 ======
    await page.screenshot({ path: 'screenshots/final-state.png', fullPage: true });
    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
