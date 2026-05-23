/**
 * 修复表单名称、清理重复、设置权限、添加测试数据
 * 每一步都先确认状态再操作
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

async function saveFormEditor(page: Page): Promise<void> {
  await page.locator('button:has-text("保存")').first().click({ force: true });
  console.log('  ✓ 保存');
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
}

async function main() {
  console.log('[FIX & TEST]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    let formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`表单: ${formNames.join(' | ')}`);

    // ====== Step 1: 检查"齐妍娜"表单 ======
    console.log('\n====== Step 1: 检查"齐妍娜"表单 ======');
    const qinaEntry = page.locator('.tree-node').filter({ hasText: '齐妍娜' }).first();
    if (await qinaEntry.count() > 0) {
      // 点击进入看看
      await qinaEntry.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const text = await readPage(page);
      console.log(`"齐妍娜"表单内容:\n${text.substring(0, 500)}`);

      // 检查是否有订单管理的字段
      const hasOrderFields = text.includes('订单编号') || text.includes('关联客户') || text.includes('选择产品');
      console.log(`包含订单管理字段: ${hasOrderFields}`);

      if (hasOrderFields) {
        // 这就是被误重命名的订单管理！需要改回名称
        console.log('→ 这是订单管理表单，需要重命名回"订单管理"');
        await goHome(page);

        await qinaEntry.hover({ force: true });
        await page.waitForTimeout(600);
        await qinaEntry.locator('.entry-set-icon').click({ force: true });
        await page.waitForTimeout(600);

        const renameItem = page.locator('li:has-text("修改名称")').last();
        if (await renameItem.count() > 0) {
          await renameItem.click({ force: true });
          await page.waitForTimeout(1000);

          const nameInput = page.locator('.fx-entry-modify-dialog input.input-inner, [class*="modify"] input.input-inner').first();
          if (await nameInput.count() > 0) {
            await nameInput.click({ clickCount: 3, force: true });
            await nameInput.fill('订单管理');
            await page.waitForTimeout(300);

            const confirmBtn = page.locator('button:has-text("确定")').last();
            if (await confirmBtn.count() > 0) {
              await confirmBtn.click({ force: true });
              console.log('  ✓ 已重命名为订单管理');
              await page.waitForTimeout(2000);
            }
          }
        }
      }
    }

    // ====== Step 2: 清理重复订单明细表 ======
    await goHome(page);
    formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n====== Step 2: 清理重复 ======`);
    console.log(`当前表单: ${formNames.join(' | ')}`);

    const detailForms = formNames.filter(n => n === '订单明细表');
    console.log(`订单明细表数量: ${detailForms.length}`);

    if (detailForms.length > 1) {
      console.log('需要删除多余的订单明细表...');
      // 反复删除直到只剩一个
      for (let attempt = 0; attempt < detailForms.length - 1; attempt++) {
        await goHome(page);
        const entry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).last();
        if (await entry.count() === 0) break;

        // Hover + force click操作图标
        await entry.hover({ force: true });
        await page.waitForTimeout(800);

        // 直接用 .entry-set-icon 的 nth 来定位
        const icon = entry.locator('.entry-set-icon');
        await icon.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        await icon.click({ force: true });
        await page.waitForTimeout(800);

        const deleteItem = page.locator('li:has-text("删除")').last();
        if (await deleteItem.count() > 0 && await deleteItem.isVisible().catch(() => false)) {
          await deleteItem.click({ force: true });
          await page.waitForTimeout(1000);

          const alertText = await page.locator('[class*="x-alert"]').first().innerText().catch(() => '');
          console.log(`  弹窗: ${alertText.substring(0, 200).replace(/\n/g, ' ')}`);

          if (alertText.includes('确定要删除')) {
            const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
            if (await delBtn.count() > 0) {
              // 等待倒计时
              await page.waitForTimeout(3500);
              await delBtn.click({ force: true }).catch(() => {});
              console.log('  ✓ 已删除');
              await page.waitForTimeout(2000);
            }
          } else {
            await page.locator('button:has-text("我知道了")').last().click({ force: true }).catch(() => {});
            console.log('  无法删除');
            break;
          }
        }
      }
    }

    // ====== Step 3: 最终表单列表 ======
    await goHome(page);
    formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n====== Step 3: 最终表单 ======`);
    console.log(`表单: ${formNames.join(' | ')}`);

    // ====== Step 4: 设置权限 ======
    console.log('\n====== Step 4: 设置权限 ======');
    const targetForms = formNames.filter(n => n !== '订单明细表' || formNames.filter(x => x === '订单明细表').length === 1);
    const uniqueForms = [...new Set(formNames)].filter(n => n && n !== '未命名表单');

    for (const formName of uniqueForms) {
      console.log(`\n检查 "${formName}" 权限...`);
      await goHome(page);

      const entry = page.locator('.tree-node').filter({ hasText: formName }).first();
      if (await entry.count() === 0) continue;

      await entry.hover({ force: true });
      await page.waitForTimeout(600);
      await entry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);

      // 点击表单发布
      const publishItem = page.locator('li:has-text("表单发布")').last();
      const piCount = await publishItem.count();
      if (piCount > 0 && await publishItem.isVisible().catch(() => false)) {
        await publishItem.click({ force: true });
        await page.waitForTimeout(2500);
        await waitForStableDOM(page);
      } else {
        console.log('  未找到表单发布选项');
        continue;
      }

      const text = await readPage(page);
      const hasQina = text.includes('齐妍娜');
      const hasFullPerm = text.includes('管理全部数据');

      console.log(`  齐妍娜: ${hasQina ? '存在' : '不存在'}, 管理全部数据: ${hasFullPerm ? '✓' : '✗'}`);

      await page.screenshot({ path: `screenshots/perm-check-${formName}.png`, fullPage: true });

      if (hasQina && !hasFullPerm) {
        // 需要修改权限级别
        console.log('  修改权限级别...');
        // 点击齐妍娜所在行的权限下拉
        const qinaRow = page.locator('tr:has-text("齐妍娜")').first();
        if (await qinaRow.count() > 0) {
          const permCell = qinaRow.locator('.x-biz-dropdown-label, td').last();
          await permCell.click({ force: true });
          await page.waitForTimeout(1000);

          const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
          if (await manageAll.count() > 0 && await manageAll.isVisible().catch(() => false)) {
            await manageAll.click({ force: true });
            console.log('  ✓ 已选择管理全部数据');
            await page.waitForTimeout(500);

            // 保存权限
            const savePerm = page.locator('button:has-text("确定")').last();
            if (await savePerm.count() > 0) {
              await savePerm.click({ force: true });
              await page.waitForTimeout(1500);
            }
          }
        }
      }
    }

    // ====== Step 5: 添加测试数据 ======
    console.log('\n====== Step 5: 添加测试数据 ======');

    // 先确认表单列表
    await goHome(page);
    formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`可用表单: ${formNames.join(' | ')}`);

    // 找客户信息表单
    const custForm = formNames.find(n => n === '客户信息');
    const prodForm = formNames.find(n => n === '产品信息');
    const orderForm = formNames.find(n => n === '订单管理');

    // --- 客户 ---
    if (custForm) {
      console.log('\n--- 添加客户数据 ---');
      await goHome(page);
      await page.locator('.tree-node').filter({ hasText: '客户信息' }).first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      await page.screenshot({ path: 'screenshots/cust-list.png', fullPage: true });

      // 找新建按钮
      const newBtn = page.locator('button:has-text("新建")').first();
      if (await newBtn.count() > 0 && await newBtn.isVisible().catch(() => false)) {
        await newBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);

        const inputs = page.locator('input.input-inner:not([readonly])');
        const cnt = await inputs.count();
        console.log(`  输入框: ${cnt}个`);
        if (cnt >= 1) await inputs.nth(0).fill('张三');
        if (cnt >= 2) await inputs.nth(1).fill('13800138000');
        if (cnt >= 3) await inputs.nth(2).fill('VIP');
        if (cnt >= 4) await inputs.nth(3).fill('上海市浦东新区');

        await page.screenshot({ path: 'screenshots/cust-form.png', fullPage: true });

        const submitBtn = page.locator('button:has-text("提交")').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click({ force: true });
          console.log('  ✓ 客户数据已提交');
          await page.waitForTimeout(2000);
        }
      }
    }

    // --- 产品 ---
    if (prodForm) {
      console.log('\n--- 添加产品数据 ---');
      await goHome(page);
      await page.locator('.tree-node').filter({ hasText: '产品信息' }).first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      await page.screenshot({ path: 'screenshots/prod-list.png', fullPage: true });

      const newBtn = page.locator('button:has-text("新建")').first();
      if (await newBtn.count() > 0 && await newBtn.isVisible().catch(() => false)) {
        await newBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);

        const inputs = page.locator('input.input-inner:not([readonly])');
        const cnt = await inputs.count();
        console.log(`  输入框: ${cnt}个`);
        if (cnt >= 1) await inputs.nth(0).fill('智能手机');
        if (cnt >= 2) await inputs.nth(1).fill('标准版');
        if (cnt >= 3) await inputs.nth(2).fill('2999');
        if (cnt >= 4) await inputs.nth(3).fill('100');
        if (cnt >= 5) await inputs.nth(4).fill('P001');

        await page.screenshot({ path: 'screenshots/prod-form.png', fullPage: true });

        const submitBtn = page.locator('button:has-text("提交")').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click({ force: true });
          console.log('  ✓ 产品数据已提交');
          await page.waitForTimeout(2000);
        }
      }
    }

    // --- 订单 ---
    if (orderForm) {
      console.log('\n--- 添加订单数据 ---');
      await goHome(page);
      await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      await page.screenshot({ path: 'screenshots/order-list.png', fullPage: true });

      const newBtn = page.locator('button:has-text("新建")').first();
      if (await newBtn.count() > 0 && await newBtn.isVisible().catch(() => false)) {
        await newBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);

        const text = await readPage(page);
        console.log(`  订单表单内容:\n${text.substring(0, 1000)}`);
        await page.screenshot({ path: 'screenshots/order-form.png', fullPage: true });

        // 填订单编号
        const inputs = page.locator('input.input-inner:not([readonly])');
        const cnt = await inputs.count();
        console.log(`\n  输入框: ${cnt}个`);
        for (let i = 0; i < Math.min(cnt, 5); i++) {
          const ph = await inputs.nth(i).getAttribute('placeholder').catch(() => '');
          console.log(`  [${i}] placeholder="${ph}"`);
        }
        if (cnt >= 1) await inputs.nth(0).fill('ORD-20260522-001');

        // 点击关联数据选择客户
        const assocBtn = page.locator('button:has-text("关联数据"), button.data-select-btn').first();
        if (await assocBtn.count() > 0 && await assocBtn.isVisible().catch(() => false)) {
          await assocBtn.click({ force: true });
          console.log('  已点击关联数据按钮');
          await page.waitForTimeout(2000);

          const text2 = await readPage(page);
          console.log(`  关联弹窗: ${text2.substring(0, 600)}`);
          await page.screenshot({ path: 'screenshots/order-assoc-dialog.png', fullPage: true });

          // 选第一条数据
          const firstRow = page.locator('[class*="row"]:has-text("张"), tr:has-text("张"), [class*="record"]').first();
          if (await firstRow.count() > 0 && await firstRow.isVisible().catch(() => false)) {
            await firstRow.click({ force: true });
            console.log('  已选择客户记录');
            await page.waitForTimeout(500);
          }

          // 确定
          const confirm = page.locator('button:has-text("确定")').last();
          if (await confirm.count() > 0 && await confirm.isVisible().catch(() => false)) {
            await confirm.click({ force: true });
            await page.waitForTimeout(1000);
          }
        }

        // 选择数据
        const chooseBtn = page.locator('button:has-text("选择数据"), button:has-text("选择产品")').first();
        if (await chooseBtn.count() > 0 && await chooseBtn.isVisible().catch(() => false)) {
          await chooseBtn.click({ force: true });
          console.log('  已点击选择数据按钮');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: 'screenshots/order-choose-dialog.png', fullPage: true });

          // 选第一条
          const firstRow = page.locator('[class*="row"]:has-text("智能"), tr:has-text("智能"), [class*="record"]').first();
          if (await firstRow.count() > 0 && await firstRow.isVisible().catch(() => false)) {
            await firstRow.click({ force: true });
            console.log('  已选择产品记录');
            await page.waitForTimeout(500);
          }

          const confirm = page.locator('button:has-text("确定")').last();
          if (await confirm.count() > 0 && await confirm.isVisible().catch(() => false)) {
            await confirm.click({ force: true });
            await page.waitForTimeout(1000);
          }
        }

        await page.screenshot({ path: 'screenshots/order-filled.png', fullPage: true });

        // 提交订单
        const submitBtn = page.locator('button:has-text("提交")').first();
        if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click({ force: true });
          console.log('  ✓ 订单数据已提交');
          await page.waitForTimeout(2000);
        }
      }
    }

    // ====== 最终截图 ======
    await page.screenshot({ path: 'screenshots/final-end.png', fullPage: true });
    console.log('\n====== 全部完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
