/**
 * 诊断录入页：
 * 1. 检查子表为什么不显示
 * 2. 检查面板的完整HTML结构
 * 3. 检查表单是否已发布
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
  console.log('[DIAG ENTRY FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 检查编辑器中的配置 ======
    console.log('====== 1. 编辑器配置 ======');
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

    // 点订单明细字段查看配置
    const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    await subField.click({ force: true });
    await page.waitForTimeout(1500);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`关联子表属性:\n${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 800)}`);

    // 检查表单是否发布 - 看有没有发布按钮/状态
    const saveBtn = page.locator('button:has-text("保存")').first();
    const saveText = await saveBtn.innerText().catch(() => '');
    console.log(`\n保存按钮: "${saveText}"`);

    // 看有没有"发布"相关按钮
    const publishBtns = await page.evaluate(() => {
      return [...document.querySelectorAll('button, a, span')]
        .filter(el => (el.textContent || '').includes('发布') && (el as HTMLElement).offsetHeight > 0)
        .map(el => ({ text: el.textContent?.trim()?.substring(0, 30), tag: el.tagName }));
    });
    console.log(`发布相关元素: ${JSON.stringify(publishBtns)}`);

    await page.screenshot({ path: 'screenshots/diag-entry-editor.png', fullPage: true });

    // ====== 2. 检查录入页 ======
    console.log('\n====== 2. 录入页检查 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.screenshot({ path: 'screenshots/diag-entry-page.png', fullPage: true });

    // 检查表单的完整HTML结构，找子表相关元素
    const formHTML = await page.evaluate(() => {
      // 查找表单内容区域
      const formArea = document.querySelector('[class*="form-body"], [class*="form-content"], [class*="form-area"], form');
      if (!formArea) return 'no form area found';

      const html = formArea.outerHTML || formArea.innerHTML;
      // 搜索"订单明细"相关的HTML
      const idx = html.indexOf('订单明细');
      if (idx < 0) return `HTML中没有"订单明细"。总长度: ${html.length}`;

      return html.substring(Math.max(0, idx - 300), idx + 600);
    });
    console.log(`表单HTML(订单明细附近):\n${formHTML}`);

    // 搜索所有 sub-table, link-table, related-form 元素
    const tableEls = await page.evaluate(() => {
      const selectors = ['[class*="sub-table"]', '[class*="link-table"]', '[class*="related-form"]',
        '[class*="subtable"]', '[class*="child-table"]', '[class*="detail-table"]'];
      const results: any[] = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          if ((el as HTMLElement).offsetHeight > 0 || (el as HTMLElement).offsetWidth > 0) {
            results.push({
              selector: sel,
              tag: el.tagName,
              class: (el as HTMLElement).className?.substring(0, 200),
              html: el.outerHTML?.substring(0, 500),
              rect: JSON.stringify(el.getBoundingClientRect()),
            });
          }
        });
      }
      return results;
    });
    console.log(`\n关联表相关元素: ${tableEls.length}个`);
    tableEls.forEach(el => console.log(`  ${el.selector}: <${el.tag}> class="${el.class}" rect=${el.rect}`));

    // ====== 3. 打开关联数据面板，分析面板结构 ======
    console.log('\n====== 3. 关联数据面板分析 ======');

    const assocBtn = page.locator('button:has-text("关联数据")').first();
    if (await assocBtn.count() > 0) {
      await assocBtn.click({ force: true });
      await page.waitForTimeout(3000);
    }

    // 分析面板HTML
    const panelInfo = await page.evaluate(() => {
      // 查找所有可能的panel/drawer
      const panels = [...document.querySelectorAll('[class*="drawer"], [class*="panel"], [class*="side"], [class*="slide"]')]
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 200 && (el as HTMLElement).offsetHeight > 0;
        });

      return panels.map(p => ({
        class: (p as HTMLElement).className?.substring(0, 200),
        rect: JSON.stringify(p.getBoundingClientRect()),
        footerHTML: p.querySelector('[class*="footer"]')?.outerHTML?.substring(0, 500) || 'no footer',
        buttons: [...p.querySelectorAll('button')].map(b => ({
          text: b.textContent?.trim(),
          class: b.className?.substring(0, 100),
        })),
      }));
    });

    console.log(`面板: ${panelInfo.length}个`);
    panelInfo.forEach((p, i) => {
      console.log(`  [${i}] class="${p.class}"`);
      console.log(`       rect=${p.rect}`);
      console.log(`       buttons=${JSON.stringify(p.buttons)}`);
      console.log(`       footer=${p.footerHTML}`);
    });

    await page.screenshot({ path: 'screenshots/diag-panel-structure.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
