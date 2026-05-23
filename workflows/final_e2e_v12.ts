/**
 * 最终端到端测试 V12 - 完整流程 + 双重验证
 *
 * 流程:
 * 1. 打开订单管理表单
 * 2. 填写基本信息 (订单编号, 下单日期)
 * 3. 关联数据 → 选择客户 (张三)
 * 4. 选择数据 → 选择产品 (智能手机)
 * 5. 关联子表 → 添加行 + 填写数据 (产品名称/数量/单价/金额)
 * 6. 提交表单
 * 7. 验证: 主记录在列表中 ✓
 * 8. 验证: 子表数据在订单明细表中 ✓ (通过数据管理tab)
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

// 生成唯一订单ID
const now = new Date();
const ORDER_ID = `ORD-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

async function selectInDialog(page: Page, rowText: string): Promise<void> {
  await page.waitForTimeout(1500);
  for (const sel of ['.fx-lookup-dialog', '.fx-linkfield-dialog']) {
    const dlg = page.locator(sel).first();
    if (await dlg.isVisible().catch(() => false)) {
      const row = dlg.locator('tbody tr').filter({ hasText: rowText }).first();
      if (await row.count() > 0) {
        await row.click({ force: true });
        await page.waitForTimeout(1500);
      }
    }
  }
}

async function ensureManageAll(page: Page): Promise<void> {
  const text = await page.locator('body').first().innerText().catch(() => '');
  if (text.includes('仅添加数据')) {
    await page.locator('text=仅添加数据').first().click({ force: true });
    await page.waitForTimeout(800);
    const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
    if (await manageAll.count() > 0) await manageAll.click({ force: true });
    await page.waitForTimeout(1500);
  }
}

async function main() {
  console.log(`[FINAL E2E V12] ${ORDER_ID}\n`);
  const wd = startWatchdog({ hardTimeoutMs: 360_000 });
  const s = await launchBrowser();
  let success = true;

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 打开表单 ======
    console.log('====== 1. 打开订单管理 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);
    await ensureManageAll(page);

    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);
    console.log('✓ 表单已打开');

    // ====== 2. 填写基本信息 ======
    console.log('\n====== 2. 基本信息 ======');
    const formInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    const fiCount = await formInputs.count();
    if (fiCount >= 2) {
      await formInputs.nth(0).fill(ORDER_ID);
      await formInputs.nth(1).fill('2026-05-23');
      console.log(`✓ 订单编号: ${ORDER_ID}`);
      console.log('✓ 下单日期: 2026-05-23');
    }

    // ====== 3. 关联客户 ======
    console.log('\n====== 3. 关联客户 ======');
    const assocBtn = page.locator('.fx-form.form-modal button:has-text("关联数据")').first();
    await assocBtn.click({ force: true });
    await selectInDialog(page, '张三');
    console.log('✓ 关联客户: 张三');

    // ====== 4. 选择产品 ======
    console.log('\n====== 4. 选择产品 ======');
    const chooseBtn = page.locator('.fx-form.form-modal button:has-text("选择数据")').first();
    await chooseBtn.click({ force: true });
    await selectInDialog(page, '智能手机');
    console.log('✓ 选择产品: 智能手机');

    await page.screenshot({ path: 'screenshots/e2ev12-1-selections.png', fullPage: true });

    // ====== 5. 关联子表 ======
    console.log('\n====== 5. 关联子表 ======');
    const subAddBtn = page.locator('button.btn-add').first();
    if (await subAddBtn.count() > 0) {
      await subAddBtn.click({ force: true });
      console.log('✓ 已添加子表行');
      await page.waitForTimeout(2000);
    }

    // 填写子表数据
    const subInputs = page.locator('.fx-related-form input:not([type="hidden"]):not([type="checkbox"])');
    const siCount = await subInputs.count();
    console.log(`子表输入框: ${siCount}个`);

    const subData = ['智能手机', '2', '2999', '5998'];
    if (siCount >= 4) {
      for (let i = 0; i < 4; i++) {
        await subInputs.nth(i).fill(subData[i]);
      }
      console.log(`✓ 子表数据: ${subData.join(', ')}`);
    }

    await page.screenshot({ path: 'screenshots/e2ev12-2-subtable.png', fullPage: true });

    // ====== 6. 提交 ======
    console.log('\n====== 6. 提交 ======');
    const submitBtn = page.locator('.fx-form.form-modal button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已点击提交');
      await page.waitForTimeout(4000);
    }

    const text = await page.locator('body').first().innerText().catch(() => '');
    const recordInList = text.includes(ORDER_ID);
    console.log(`\n主记录出现: ${recordInList ? '✓' : '✗'}`);
    if (!recordInList) success = false;

    await page.screenshot({ path: 'screenshots/e2ev12-3-result.png', fullPage: true });

    // ====== 7. 验证订单明细表 ======
    console.log('\n====== 7. 验证订单明细表 ======');
    await page.locator('.tree-node').filter({ hasText: '订单明细表' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 点"数据管理"tab 查看数据列表
    const dataMgmtTab = page.locator('span:has-text("数据管理")').first();
    if (await dataMgmtTab.count() > 0 && await dataMgmtTab.isVisible().catch(() => false)) {
      await dataMgmtTab.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      console.log('✓ 已切换到数据管理视图');
    }

    const detailText = await page.locator('body').first().innerText().catch(() => '');
    const hasSubData = detailText.includes(ORDER_ID) && detailText.includes('智能手机');
    console.log(`订单明细表有子表数据: ${hasSubData ? '✓' : '✗'}`);

    if (hasSubData) {
      // 提取包含 ORDER_ID 的那几行
      const lines = detailText.split('\n');
      const relevantLines = lines.filter((l, i) => {
        for (let j = Math.max(0, i - 1); j <= Math.min(lines.length - 1, i + 1); j++) {
          if (lines[j].includes(ORDER_ID)) return true;
        }
        return false;
      });
      console.log(`\n订单明细表中 ${ORDER_ID} 相关行:`);
      relevantLines.forEach(l => console.log(`  ${l}`));
    } else {
      success = false;
    }

    await page.screenshot({ path: 'screenshots/e2ev12-4-detail-table.png', fullPage: true });

    // ====== 总结 ======
    console.log(`\n====== E2E V12 ${success ? '✓ 成功' : '✗ 失败'} ======`);
    console.log(`订单编号: ${ORDER_ID}`);
    console.log(`主记录保存: ${recordInList ? '✓' : '✗'}`);
    console.log(`子表数据保存: ${hasSubData ? '✓' : '✗'}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
