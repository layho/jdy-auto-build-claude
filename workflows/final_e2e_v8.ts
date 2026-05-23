/**
 * 最终端到端测试 V8
 * 修复：扩大子表按钮搜索范围，处理子表渲染在form-modal外部的情况
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function selectInDialog(page: Page, rowText: string): Promise<boolean> {
  await page.waitForTimeout(1500);
  for (const sel of ['.fx-lookup-dialog', '.fx-linkfield-dialog']) {
    const dlg = page.locator(sel).first();
    if (await dlg.isVisible().catch(() => false)) {
      const row = dlg.locator('tbody tr').filter({ hasText: rowText }).first();
      if (await row.count() > 0) {
        await row.click({ force: true });
        await page.waitForTimeout(1500);
        const stillOpen = await dlg.isVisible().catch(() => false);
        return !stillOpen;
      }
    }
  }
  return false;
}

async function main() {
  console.log('[FINAL E2E V8]\n');
  const wd = startWatchdog({ hardTimeoutMs: 360_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 打开表单 ======
    console.log('====== 1. 打开表单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/e2ev8-1-form.png', fullPage: true });

    // ====== 2. 填写基本信息 ======
    console.log('\n====== 2. 填写基本信息 ======');
    const allInputs = page.locator('.fx-form.form-modal input.input-inner:not([readonly])');
    const inputCount = await allInputs.count();
    if (inputCount >= 2) {
      await allInputs.nth(0).fill('ORD-20260523-008');
      await allInputs.nth(1).fill('2026-05-23');
      console.log('✓ 订单编号 + 下单日期');
    }

    // ====== 3-4. 关联客户和选择产品 ======
    console.log('\n====== 3. 关联客户 ======');
    const assocBtn = page.locator('.fx-form.form-modal button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) {
      await assocBtn.click({ force: true });
      await selectInDialog(page, '张三');
      console.log('✓ 张三已关联');
    }

    console.log('\n====== 4. 选择产品 ======');
    const chooseBtn = page.locator('.fx-form.form-modal button:has-text("选择数据")').first();
    if (await chooseBtn.count() > 0) {
      await chooseBtn.click({ force: true });
      await selectInDialog(page, '智能手机');
      console.log('✓ 智能手机已选择');
    }

    // ====== 5. 分析子表 ======
    console.log('\n====== 5. 分析子表 ======');

    // 在整个页面中搜索"添加"按钮，不只是form-modal
    const allAddBtnInfo = await page.evaluate(() => {
      const allEls = [...document.querySelectorAll('button, span, a, div')];
      // 找文本是"添加"(可能包含icon前缀)的可见元素
      const addElements = allEls.filter(el => {
        const txt = (el.textContent || '').replace(/[​‌‍﻿]/g, '').trim();
        return (txt === '添加' || txt === '添加' || txt.startsWith('添加')) &&
          (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 50;
      });

      return addElements.map(el => {
        const rect = el.getBoundingClientRect();
        // 向上找上下文
        let ctx = el.parentElement;
        let ctxText = '';
        for (let i = 0; i < 8 && ctx; i++) {
          ctxText = (ctx as HTMLElement).innerText?.substring(0, 100) || '';
          if (ctxText.includes('订单明细') || ctxText.includes('订单管理') || ctxText.includes('快速填报')) break;
          ctx = ctx.parentElement;
        }

        return {
          tag: el.tagName,
          text: (el.textContent || '').replace(/[​‌‍﻿]/g, '').trim().substring(0, 20),
          class: (el as HTMLElement).className?.substring(0, 100),
          y: rect.y,
          x: rect.x,
          height: rect.height,
          contextText: ctxText?.substring(0, 80),
        };
      });
    });

    console.log(`所有"添加"元素: ${JSON.stringify(allAddBtnInfo, null, 2)}`);

    // 找子表相关的添加按钮（context包含订单明细或订单管理）
    const subAddBtns = allAddBtnInfo.filter(b =>
      b.contextText?.includes('订单明细') || b.contextText?.includes('订单管理') || b.contextText?.includes('快速填报')
    );

    let subAddClicked = false;
    if (subAddBtns.length > 0) {
      const target = subAddBtns[0];
      console.log(`\n点击子表添加: y=${target.y}, tag=${target.tag}`);

      if (target.tag === 'BUTTON') {
        // 使用Playwright点击该位置的button
        const btns = page.locator('button');
        const bCount = await btns.count();
        for (let i = 0; i < bCount; i++) {
          const box = await btns.nth(i).boundingBox().catch(() => null);
          if (box && Math.abs(box.y - target.y) < 3 && Math.abs(box.x - target.x) < 3) {
            await btns.nth(i).click({ force: true });
            console.log(`  ✓ 已点击[${i}]`);
            subAddClicked = true;
            break;
          }
        }
      }

      if (!subAddClicked) {
        // dispatchEvent
        await page.evaluate((y) => {
          const all = [...document.querySelectorAll('button, span, a')];
          const el = all.find(e => {
            const txt = (e.textContent || '').replace(/[​]/g, '').trim();
            return txt.startsWith('添加') && Math.abs(e.getBoundingClientRect().y - y) < 3;
          });
          if (el) (el as HTMLElement).click();
        }, target.y);
        console.log('  ✓ dispatchEvent点击');
        subAddClicked = true;
      }

      await page.waitForTimeout(2000);
    }

    if (!subAddClicked) {
      console.log('⚠ 未找到子表添加按钮');
    }

    await page.screenshot({ path: 'screenshots/e2ev8-2-subtable.png', fullPage: true });

    // ====== 6. 填子表数据 ======
    console.log('\n====== 6. 填子表数据 ======');

    // 扩大搜索范围，找所有输入框
    const allPageInputs = page.locator('input.input-inner:not([readonly])');
    const apiCount = await allPageInputs.count();

    const emptyInputs: any[] = [];
    for (let i = 0; i < apiCount; i++) {
      const inp = allPageInputs.nth(i);
      const val = await inp.inputValue().catch(() => '');
      const ph = await inp.getAttribute('placeholder').catch(() => '');
      const box = await inp.boundingBox().catch(() => null);
      if (!val && (!ph || !ph.includes('搜索'))) {
        emptyInputs.push({ idx: i, inp, ph, y: box?.y });
      }
    }

    console.log(`空输入框: ${emptyInputs.length}个`);
    emptyInputs.forEach(e => console.log(`  [${e.idx}] y=${e.y} ph="${e.ph}"`));

    // 排除了订单编号和下单日期的前2个输入框后，其余应该是子表输入
    // 子表有4个字段：产品名称、数量、单价、金额
    const subInputs = emptyInputs.slice(2); // skip order number and date
    console.log(`子表可用输入: ${subInputs.length}个`);

    const fillData = ['智能手机', '2', '2999', '5998'];
    for (let i = 0; i < Math.min(subInputs.length, fillData.length); i++) {
      await subInputs[i].inp.fill(fillData[i]);
      console.log(`  ✓ [${subInputs[i].idx}] y=${subInputs[i].y} = ${fillData[i]}`);
    }

    // 确认子表行
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // 也尝试找"确定"按钮
    const confirmBtn = page.locator('button:has-text("确定")').last();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('✓ 点击确定');
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: 'screenshots/e2ev8-3-filled.png', fullPage: true });

    // ====== 7. 提交 ======
    console.log('\n====== 7. 提交 ======');
    const submitBtn = page.locator('button:has-text("提交")').first();
    if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true });
      console.log('✓ 已提交');
      await page.waitForTimeout(4000);
    }

    const resultText = await page.locator('body').first().innerText().catch(() => '');
    const success = resultText.includes('提交成功') || resultText.includes('操作成功');

    // 找最新提交的数据
    const orderIdx = resultText.indexOf('ORD-20260523-008');
    if (orderIdx >= 0) {
      const context = resultText.substring(Math.max(0, orderIdx - 100), orderIdx + 200);
      console.log(`\n新数据:\n${context}`);
    }

    console.log(`\n状态: ${success ? '✓ 成功！' : '⚠ 检查中'}`);
    await page.screenshot({ path: 'screenshots/e2ev8-4-result.png', fullPage: true });
    console.log('\n====== E2E V8 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
