/**
 * 诊断：获取录入表单的完整HTML结构，查找子表
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[DIAG FORM HTML]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 先检查预览模式 ======
    console.log('====== 1. 编辑器预览 ======');
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

    // 点击预览
    const previewBtn = page.locator('button:has-text("预览")').first();
    if (await previewBtn.count() > 0) {
      await previewBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`预览模式子表: ${text.includes('订单明细') ? '✓' : '✗'}`);
      console.log(`预览内容:\n${text.substring(0, 2000)}`);

      await page.screenshot({ path: 'screenshots/diag-preview-form.png', fullPage: true });

      // 关闭预览
      const closeBtn = page.locator('button:has-text("关闭"), [class*="close"]').first();
      if (await closeBtn.count() > 0) await closeBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // ====== 2. 录入页表单HTML分析 ======
    console.log('\n====== 2. 录入页表单HTML ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 切换视图
    let text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 点添加
    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 获取完整HTML中所有包含"订单明细"的上下文
    const htmlAnalysis = await page.evaluate(() => {
      const html = document.body.innerHTML;

      // 找"订单明细"在HTML中的所有出现位置
      const indices: number[] = [];
      let idx = html.indexOf('订单明细');
      while (idx !== -1) {
        indices.push(idx);
        idx = html.indexOf('订单明细', idx + 1);
      }

      const contexts = indices.map(i => {
        const start = Math.max(0, i - 500);
        const end = Math.min(html.length, i + 1000);
        return {
          index: i,
          context: html.substring(start, end),
        };
      });

      // 找所有包含subtable/sub-table/related-form/child-table的HTML
      const subtablePatterns: string[] = [];
      for (const pattern of ['subtable', 'sub-table', 'subgrid', 'related-form', 'child-table', 'embed-form', 'sub-form']) {
        let pIdx = html.indexOf(pattern);
        let count = 0;
        while (pIdx !== -1 && count < 5) {
          const start = Math.max(0, pIdx - 100);
          const end = Math.min(html.length, pIdx + 300);
          subtablePatterns.push(`[${pattern}] ${html.substring(start, end)}`);
          pIdx = html.indexOf(pattern, pIdx + 1);
          count++;
        }
      }

      return { orderDetailContexts: contexts, subtablePatterns };
    });

    console.log(`订单明细出现次数: ${htmlAnalysis.orderDetailContexts.length}`);
    htmlAnalysis.orderDetailContexts.forEach((ctx, i) => {
      console.log(`\n--- 出现 #${i + 1} (index ${ctx.index}) ---`);
      console.log(ctx.context.substring(0, 600));
    });

    console.log(`\n子表相关模式:`);
    htmlAnalysis.subtablePatterns.forEach(p => console.log(`\n${p.substring(0, 400)}`));

    // ====== 3. 查找form/drawer中的所有输入和按钮 ======
    console.log('\n====== 3. 表单组件分析 ======');
    const formComponents = await page.evaluate(() => {
      // 查找所有高z-index或固定定位的包含表单的元素
      const containers = [...document.querySelectorAll('[style*="z-index"], .x-dialog, [class*="drawer"], [class*="slide"], [class*="panel"], [class*="form-wrap"]')]
        .filter(el => {
          const style = window.getComputedStyle(el);
          const zIdx = parseInt(style.zIndex);
          return (zIdx > 1 || el.className?.includes('dialog') || el.className?.includes('drawer')) &&
            (el as HTMLElement).offsetHeight > 200;
        });

      return containers.map(c => ({
        tag: c.tagName,
        class: (c as HTMLElement).className?.substring(0, 300),
        rect: JSON.stringify(c.getBoundingClientRect()),
        scrollHeight: c.scrollHeight,
        clientHeight: c.clientHeight,
        hasOrderDetail: (c as HTMLElement).innerText?.includes('订单明细'),
        containsFormFields: (c as HTMLElement).innerText?.includes('提交') && (c as HTMLElement).innerText?.includes('关联'),
        // Find subtable-related elements within
        innerSubtableEls: [...c.querySelectorAll('[class*="subtable"], [class*="sub-table"], [class*="sub-form"], [class*="child"]')]
          .map(el => ({
            tag: el.tagName,
            class: (el as HTMLElement).className?.substring(0, 150),
            visible: (el as HTMLElement).offsetHeight > 0,
          })),
        inputCount: c.querySelectorAll('input').length,
        buttonCount: c.querySelectorAll('button').length,
        // Check for the form body
        formBodyHTML: c.querySelector('[class*="form-body"], [class*="form-content"]')?.innerHTML?.substring(0, 1000),
      }));
    });

    console.log(JSON.stringify(formComponents, null, 2));
    await page.screenshot({ path: 'screenshots/diag-form-html.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
