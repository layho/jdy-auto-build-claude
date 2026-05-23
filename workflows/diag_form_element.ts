/**
 * 诊断：直接查找包含表单字段的DOM元素，检查子表
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
  console.log('[DIAG FORM ELEMENT]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入表单
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

    // 点添加
    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 找包含"提交"和"关联客户"的容器
    const formInfo = await page.evaluate(() => {
      // 找提交按钮
      const allBtns = [...document.querySelectorAll('button')];
      const submitBtn = allBtns.find(b => (b.textContent || '').trim() === '提交' && (b as HTMLElement).offsetHeight > 0);
      if (!submitBtn) return { error: 'no submit button' };

      // 向上找包含表单的容器
      let formContainer: Element | null = submitBtn;
      const chain: string[] = [];
      for (let i = 0; i < 15; i++) {
        formContainer = formContainer.parentElement;
        if (!formContainer) break;
        const cls = (formContainer as HTMLElement).className?.substring(0, 100) || '';
        const tag = formContainer.tagName;
        chain.push(`${tag}${cls ? '.' + cls.split(' ')[0] : ''}`);

        // 检查是否包含表单所有字段
        const innerText = (formContainer as HTMLElement).innerText || '';
        if (innerText.includes('关联客户') && innerText.includes('提交') && (formContainer as HTMLElement).offsetHeight > 300) {
          const hasSubtable = innerText.includes('订单明细');
          const fullHTML = formContainer.outerHTML?.substring(0, 5000) || '';

          // 查找内部的子表相关元素
          const innerEls = [...formContainer.querySelectorAll('*')];
          const subtableLike = innerEls.filter(el => {
            const cls = String((el as HTMLElement).className || '');
            return cls.includes('subtable') || cls.includes('sub-table') ||
                   cls.includes('relatedform') || cls.includes('related-form') ||
                   cls.includes('child-table') || cls.includes('childtable');
          }).map(el => ({
            tag: el.tagName,
            class: (el as HTMLElement).className?.substring(0, 200),
            visible: (el as HTMLElement).offsetHeight > 0,
            rect: JSON.stringify(el.getBoundingClientRect()),
            innerHTML: el.innerHTML?.substring(0, 500),
          }));

          // Also find ALL elements containing "订单明细" text
          const orderDetailEls = innerEls.filter(el => {
            const txt = (el.textContent || '').trim();
            return txt === '订单明细' || txt.startsWith('订单明细');
          }).map(el => ({
            tag: el.tagName,
            class: (el as HTMLElement).className?.substring(0, 100),
            rect: JSON.stringify(el.getBoundingClientRect()),
          }));

          return {
            containerTag: formContainer.tagName,
            containerClass: cls,
            scrollHeight: formContainer.scrollHeight,
            clientHeight: formContainer.clientHeight,
            hasSubtable,
            innerTextTail: innerText.substring(innerText.length - 300),
            fullHTML: fullHTML.substring(fullHTML.indexOf('订单明细') > 0 ? fullHTML.indexOf('订单明细') - 500 : 0, fullHTML.length).substring(0, 1500),
            subtableLike,
            orderDetailEls,
            chain: chain.join(' < '),
          };
        }
      }
      return { error: 'no form container found', chain: chain.join(' < ') };
    });

    console.log(JSON.stringify(formInfo, null, 2));

    // 滚动整个页面看是否子表在下面
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/diag-form-top.png', fullPage: true });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/diag-form-bottom.png', fullPage: true });

    // 尝试找侧边栏/抽屉
    const drawers = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="drawer"], [class*="slide"], [class*="side-panel"], [class*="offcanvas"]')]
        .filter(el => (el as HTMLElement).offsetHeight > 200)
        .map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          rect: JSON.stringify(el.getBoundingClientRect()),
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          hasOrderDetail: (el as HTMLElement).innerText?.includes('订单明细'),
        }));
    });
    console.log(`\nDrawer/Slide面板: ${JSON.stringify(drawers, null, 2)}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
