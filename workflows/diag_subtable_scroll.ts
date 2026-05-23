/**
 * 诊断：检查表单中是否真的有子表，以及是否需要滚动才能看到
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
  console.log('[DIAG SUBTABLE SCROLL]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入表单 ======
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
    }

    const addBtn = page.locator('button:has-text("添加")').first();
    if (await addBtn.count() > 0) await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== 分析表单完整结构 ======
    const formAnalysis = await page.evaluate(() => {
      // 查找表单对话框
      const formDialogs = [...document.querySelectorAll('.x-dialog, [class*="drawer"], [class*="slide"]')]
        .filter(d => (d as HTMLElement).offsetHeight > 300);

      const results: any[] = [];

      for (const dialog of formDialogs) {
        const rect = dialog.getBoundingClientRect();
        const scrollHeight = dialog.scrollHeight;
        const clientHeight = dialog.clientHeight;
        const scrollTop = dialog.scrollTop;

        // 查找"订单明细"
        const innerText = (dialog as HTMLElement).innerText || '';
        const hasOrderDetail = innerText.includes('订单明细');

        // 查找所有包含"添加"的button
        const addButtons = [...dialog.querySelectorAll('button')]
          .filter(b => (b.textContent || '').trim() === '添加' && (b as HTMLElement).offsetHeight > 0);

        // 查找子表相关元素
        const subtableEls = [...dialog.querySelectorAll('[class*="subtable"], [class*="sub-table"], [class*="related-form"], [class*="child-table"], [class*="embed"], [class*="fx-grid"]')];
        const subtableInfo = subtableEls.map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          rect: JSON.stringify(el.getBoundingClientRect()),
          visible: (el as HTMLElement).offsetHeight > 0,
          innerHTML: el.innerHTML?.substring(0, 500),
        }));

        results.push({
          class: (dialog as HTMLElement).className?.substring(0, 300),
          rect: JSON.stringify(rect),
          scrollHeight,
          clientHeight,
          scrollTop,
          canScroll: scrollHeight > clientHeight,
          hasOrderDetail,
          addButtonCount: addButtons.length,
          addButtonInfo: addButtons.map(b => ({
            text: b.textContent?.trim(),
            rect: JSON.stringify(b.getBoundingClientRect()),
            parentClass: b.parentElement?.className?.substring(0, 100),
          })),
          subtableElements: subtableInfo,
          textLength: innerText.length,
          textTail: innerText.substring(innerText.length - 500),
        });
      }

      // Also check body background for form content
      const bodyText = document.body.innerText || '';
      results.push({
        type: 'body_summary',
        includesOrderDetail: bodyText.includes('订单明细'),
        bodyTextTail: bodyText.substring(bodyText.length - 500),
      });

      return results;
    });

    console.log(JSON.stringify(formAnalysis, null, 2));
    await page.screenshot({ path: 'screenshots/diag-subtable-scroll.png', fullPage: true });

    // ====== 尝试在表单内滚动 ======
    console.log('\n====== 尝试滚动表单 ======');

    // 查找可滚动的表单内容区域
    const scrollTarget = page.locator('.x-dialog .content-wrapper, [class*="dialog-content"], [class*="form-body"]').first();
    if (await scrollTarget.count() > 0) {
      const scrollInfo = await scrollTarget.evaluate(el => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
      }));
      console.log(`滚动信息: ${JSON.stringify(scrollInfo)}`);

      if (scrollInfo.scrollHeight > scrollInfo.clientHeight) {
        // 滚动到底部
        await scrollTarget.evaluate(el => el.scrollTo(0, el.scrollHeight));
        await page.waitForTimeout(1000);

        text = await readPage(page);
        console.log(`滚动后:\n${text.substring(text.length - 800)}`);
        await page.screenshot({ path: 'screenshots/diag-subtable-scrolled.png', fullPage: true });
      }
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
