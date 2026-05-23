/**
 * 诊断为什么关联子表不在录入页显示
 * 1. 检查编辑器中关联子表的配置
 * 2. 检查是否需要发布
 * 3. 检查录入页的完整HTML
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
  console.log('[DIAG FORM DISPLAY]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 检查编辑器 ======
    console.log('====== 1. 编辑器检查 ======');
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

    // 点订单明细字段
    const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await subField.count() > 0) {
      await subField.click({ force: true });
      await page.waitForTimeout(1500);

      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`属性面板关键信息:\n${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 500)}`);

      // 检查显示字段配置
      const showIdx = text.indexOf('显示字段');
      if (showIdx >= 0) {
        console.log(`\n显示字段:\n${text.substring(showIdx, showIdx + 300)}`);
      }
    }

    await page.screenshot({ path: 'screenshots/diag-form-editor.png', fullPage: true });

    // ====== 2. 检查录入页HTML ======
    console.log('\n====== 2. 录入页HTML检查 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 检查页面上是否有"订单明细"相关的HTML元素
    const subtableHTML = await page.evaluate(() => {
      // 查找包含"订单明细"的所有元素
      const results: any[] = [];
      document.querySelectorAll('*').forEach(el => {
        const txt = (el.textContent || '').trim();
        if (txt === '订单明细' && (el as HTMLElement).offsetHeight > 0) {
          results.push({
            tag: el.tagName,
            class: (el as HTMLElement).className?.substring(0, 200),
            rect: JSON.stringify(el.getBoundingClientRect()),
            html: el.outerHTML?.substring(0, 500),
          });
        }
      });
      return results;
    });

    console.log(`"订单明细"可见元素: ${subtableHTML.length}个`);
    subtableHTML.forEach((el, i) => {
      console.log(`  [${i}] <${el.tag}> class="${el.class}"`);
      console.log(`       rect=${el.rect}`);
      console.log(`       html=${el.html}`);
    });

    // 查找包含"link-table"或"sub-table"的元素
    const linkTableEls = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="link-table"], [class*="sub-table"], [class*="related-form"], [class*="subtable"]')]
        .filter(el => (el as HTMLElement).offsetHeight > 0)
        .map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          rect: JSON.stringify(el.getBoundingClientRect()),
        }));
    });

    console.log(`\n关联表相关元素: ${linkTableEls.length}个`);
    linkTableEls.forEach(el => console.log(`  <${el.tag}> class="${el.class}" rect=${el.rect}`));

    // 检查全页HTML中包含"订单明细"的部分
    const bodyHTML = await page.evaluate(() => document.body.innerHTML?.substring(0, 8000));
    const detailIdx = bodyHTML.indexOf('订单明细');
    if (detailIdx >= 0) {
      console.log(`\nHTML中"订单明细"位置: ${detailIdx}`);
      console.log(bodyHTML.substring(Math.max(0, detailIdx - 200), detailIdx + 500));
    } else {
      console.log('\nHTML中没有"订单明细"！');
    }

    await page.screenshot({ path: 'screenshots/diag-form-entry.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
