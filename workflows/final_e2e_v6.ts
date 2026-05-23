/**
 * 最终端到端测试 V6：
 * 修复：
 * 1. 区分 fx-lookup-dialog（关联数据）和 fx-linkfield-dialog（选择数据）
 * 2. 每个对话框关闭后再继续
 * 3. 检查表单是否侧滑面板，需要关闭所有overlay才看到子表
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

async function closeAnyDialog(page: Page): Promise<boolean> {
  const dialogs = [
    '.fx-lookup-dialog',
    '.fx-linkfield-dialog',
    '[class*="lookup-dialog"]',
    '[class*="linkfield-dialog"]',
  ];
  for (const sel of dialogs) {
    const dlg = page.locator(sel).first();
    if (await dlg.isVisible().catch(() => false)) {
      // 尝试点击关闭按钮
      const closeBtn = dlg.locator('.close-btn, [class*="close"]').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(1000);
        return true;
      }
    }
  }
  return false;
}

async function selectDataInDialog(page: Page, rowText: string): Promise<boolean> {
  // 等待任意类型对话框出现
  await page.waitForTimeout(1500);

  // 尝试多种对话框选择器
  const dialogSelectors = [
    '.fx-lookup-dialog',
    '.fx-linkfield-dialog',
  ];

  let foundDialog = '';
  let dialog: any = null;

  for (const sel of dialogSelectors) {
    const d = page.locator(sel).first();
    if (await d.isVisible().catch(() => false)) {
      foundDialog = sel;
      dialog = d;
      break;
    }
  }

  if (!dialog) {
    console.log(`  ⚠ 没有找到打开的对话框（已自动选择？）`);
    return false;
  }

  console.log(`  对话框类型: ${foundDialog}`);

  // 在对话框中找包含指定文本的行
  const row = dialog.locator('tbody tr').filter({ hasText: rowText }).first();
  if (await row.count() > 0) {
    console.log(`  点击行: ${rowText}`);
    // 先尝试点radio
    const radio = row.locator('input[type="radio"], .x-radio, [class*="radio"]').first();
    if (await radio.count() > 0) {
      await radio.click({ force: true });
      await page.waitForTimeout(500);
    } else {
      await row.click({ force: true });
    }

    // 等待对话框关闭
    await page.waitForTimeout(1000);
    const stillVisible = await dialog.isVisible().catch(() => false);
    console.log(`  对话框已关闭: ${!stillVisible ? '✓' : '✗'}`);

    if (stillVisible) {
      // 尝试双击行
      await row.dblclick({ force: true });
      await page.waitForTimeout(1000);
    }
    return !stillVisible;
  }

  console.log(`  ⚠ 未找到行: ${rowText}`);
  // dump dialog rows
  const rowTexts = await dialog.locator('tbody tr').allInnerTexts().catch(() => []);
  console.log(`  对话框中的行: ${JSON.stringify(rowTexts)}`);
  return false;
}

async function main() {
  console.log('[FINAL E2E V6]\n');
  const wd = startWatchdog({ hardTimeoutMs: 360_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 打开表单 ======
    console.log('====== 1. 打开录入表单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    const addBtn = page.locator('button:has-text("添加")').first();
    if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
      await addBtn.click({ force: true });
      console.log('✓ 已点击添加');
    }
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/e2ev6-1-form-open.png', fullPage: true });

    // ====== 2. 填写订单编号 ======
    console.log('\n====== 2. 填写订单编号 ======');
    // 在表单中找到订单编号输入框
    const allInputs = page.locator('input.input-inner:not([readonly])');
    const allCount = await allInputs.count();
    const formInputs: any[] = [];
    for (let i = 0; i < allCount; i++) {
      const inp = allInputs.nth(i);
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      const rect = await inp.boundingBox().catch(() => null);
      if (!ph || !ph.includes('搜索')) {
        formInputs.push({ inp, rect });
      }
    }
    console.log(`表单输入框: ${formInputs.length}个`);

    if (formInputs.length >= 2) {
      // 第一个是订单编号，第二个是下单日期
      await formInputs[0].inp.fill('ORD-20260523-006');
      console.log('✓ 订单编号: ORD-20260523-006');
    }

    // ====== 3. 关联客户 ======
    console.log('\n====== 3. 关联客户（关联数据按钮）======');
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0 && await assocBtn.isVisible().catch(() => false)) {
      await assocBtn.click({ force: true });
      console.log('✓ 已点击关联数据');
    }
    await selectDataInDialog(page, '张三');
    await page.waitForTimeout(1000);
    text = await readPage(page);
    console.log(`关联客户: ${text.includes('张三') ? '✓' : '⚠'}`);

    // ====== 4. 选择产品 ======
    console.log('\n====== 4. 选择产品（选择数据按钮）======');
    await page.screenshot({ path: 'screenshots/e2ev6-2-before-choose.png', fullPage: true });

    const chooseBtn = page.locator('button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0 && await chooseBtn.isVisible().catch(() => false)) {
      await chooseBtn.click({ force: true });
      console.log('✓ 已点击选择数据');
    }
    await selectDataInDialog(page, '智能手机');
    await page.waitForTimeout(1000);

    // 确保对话框关闭
    await closeAnyDialog(page);
    await page.waitForTimeout(1000);

    text = await readPage(page);
    console.log(`选择产品: ${text.includes('智能手机') ? '✓' : '⚠'}`);

    await page.screenshot({ path: 'screenshots/e2ev6-3-selections-done.png', fullPage: true });

    // ====== 5. 查找子表 ======
    console.log('\n====== 5. 查找子表 ======');

    // Scroll to see the full form
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/e2ev6-4-scrolled.png', fullPage: true });

    text = await readPage(page);
    console.log(`页面全文包含订单明细: ${text.includes('订单明细')}`);

    // Find the subtable area: look for "订单明细" in a visible element that's NOT in the header
    const subtableLocation = await page.evaluate(() => {
      const allEls = [...document.querySelectorAll('*')];
      // Find ALL elements with "订单明细" text
      const allMatches = allEls
        .filter(el => {
          const txt = (el.textContent || '').trim();
          return txt === '订单明细' && (el as HTMLElement).offsetHeight > 0;
        })
        .map(el => {
          const rect = el.getBoundingClientRect();
          // Look at all ancestors for subtable indicators
          let ancestor = el.parentElement;
          const ancestorChain: string[] = [];
          for (let i = 0; i < 8 && ancestor; i++) {
            const cls = (ancestor.className || '').substring(0, 80);
            if (cls) ancestorChain.push(`${ancestor.tagName}.${cls}`);
            else ancestorChain.push(ancestor.tagName);
            ancestor = ancestor.parentElement;
          }
          return {
            tag: el.tagName,
            y: rect.y,
            height: rect.height,
            width: rect.width,
            ancestorChain: ancestorChain.join(' > '),
          };
        });

      // Also search for subtable grid
      const subGrids = [...document.querySelectorAll('[class*="subtable"], [class*="sub-table"], [class*="child-form"], [class*="embed-form"]')]
        .filter(el => (el as HTMLElement).offsetHeight > 0)
        .map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          rect: JSON.stringify(el.getBoundingClientRect()),
          innerText: (el as HTMLElement).innerText?.substring(0, 200),
        }));

      return { orderDetailMatches: allMatches, subGrids };
    });

    console.log(`订单明细位置:\n${JSON.stringify(subtableLocation, null, 2)}`);

    // ====== 6. 子表添加行 ======
    console.log('\n====== 6. 子表添加行 ======');

    // 找表单区域内的"添加"按钮（排除列表工具栏的）
    const addButtonsAnalysis = await page.evaluate(() => {
      // 找所有可见"添加"按钮
      return [...document.querySelectorAll('button')]
        .filter(b => (b.textContent || '').trim() === '添加' && (b as HTMLElement).offsetHeight > 0)
        .map(b => {
          const rect = b.getBoundingClientRect();
          // 向上找最近的container
          let container = b.closest('[class*="dialog"], [class*="drawer"], [class*="panel"], [class*="form"], [class*="slide"], [class*="wrap"]');
          if (!container) container = b.closest('div');
          const containerText = (container as HTMLElement)?.innerText?.substring(0, 200) || '';
          return {
            class: b.className?.substring(0, 120),
            rect: JSON.stringify(rect),
            y: rect.y,
            containerClass: (container as HTMLElement)?.className?.substring(0, 150),
            containerText,
            hasSubtableText: containerText.includes('订单明细'),
          };
        });
    });

    console.log(`"添加"按钮分析:\n${JSON.stringify(addButtonsAnalysis, null, 2)}`);

    // 优先点击有"订单明细"的容器内的按钮，否则点击最下方的按钮
    let subAddClicked = false;
    const sortedAdds = addButtonsAnalysis.sort((a, b) => b.y - a.y); // 按y降序
    for (const addInfo of sortedAdds) {
      if (addInfo.hasSubtableText) {
        // 找到页面上对应的按钮
        const btns = page.locator('button:has-text("添加")');
        const count = await btns.count();
        for (let i = 0; i < count; i++) {
          const btn = btns.nth(i);
          const box = await btn.boundingBox().catch(() => null);
          if (box && Math.abs(box.y - addInfo.y) < 5) {
            await btn.click({ force: true });
            console.log(`✓ 点击子表添加按钮 [y=${addInfo.y}]`);
            subAddClicked = true;
            await page.waitForTimeout(2000);
            break;
          }
        }
        if (subAddClicked) break;
      }
    }

    if (!subAddClicked) {
      // fallback: 点击最下方的"添加"
      const btns = page.locator('button:has-text("添加")');
      const count = await btns.count();
      let lowestY = -1;
      let lowestIdx = -1;
      for (let i = 0; i < count; i++) {
        const box = await btns.nth(i).boundingBox().catch(() => null);
        if (box && box.y > lowestY) {
          lowestY = box.y;
          lowestIdx = i;
        }
      }
      if (lowestIdx >= 0) {
        await btns.nth(lowestIdx).click({ force: true });
        console.log(`✓ fallback点击最低的添加按钮 [y=${lowestY}]`);
        subAddClicked = true;
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'screenshots/e2ev6-5-after-subadd.png', fullPage: true });
    text = await readPage(page);
    console.log(`添加后页面底部:\n${text.substring(Math.max(0, text.length - 1200))}`);

    // 找新的空输入框
    const allEditable = page.locator('input.input-inner:not([readonly])');
    const aeiCount = await allEditable.count();
    const emptyInputs: any[] = [];
    for (let i = 0; i < aeiCount; i++) {
      const inp = allEditable.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      if (!val && (!ph || !ph.includes('搜索'))) {
        emptyInputs.push(inp);
      }
    }
    console.log(`空输入框: ${emptyInputs.length}个`);

    const fillData = ['智能手机', '2', '2999', '5998'];
    for (let i = 0; i < Math.min(emptyInputs.length, fillData.length); i++) {
      await emptyInputs[i].fill(fillData[i]);
      console.log(`  ✓ [${i}] = ${fillData[i]}`);
    }

    // 确认子表行
    const confirmBtn = page.locator('button:has-text("确定")').last();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('✓ 子表行确认');
      await page.waitForTimeout(1000);
    }

    // ====== 7. 提交 ======
    console.log('\n====== 7. 提交 ======');
    await page.screenshot({ path: 'screenshots/e2ev6-6-before-submit.png', fullPage: true });

    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已提交');
      await page.waitForTimeout(3000);
    }

    text = await readPage(page);
    const success = text.includes('提交成功') || text.includes('操作成功') || text.includes('成功');
    console.log(`状态: ${success ? '✓ 成功' : '⚠ 待确认'}`);
    if (!success) console.log(`提交后:\n${text.substring(0, 800)}`);

    await page.screenshot({ path: 'screenshots/e2ev6-7-result.png', fullPage: true });
    console.log('\n====== E2E V6 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
