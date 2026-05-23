/**
 * 诊断：获取属性面板完整HTML结构，找到"选择主表"的可交互元素
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 属性面板HTML结构...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const formEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await formEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await formEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 点击关联数据 widget
    await page.locator('li.form-edit-widget-label:has-text("关联数据")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 获取右侧属性面板的完整HTML
    const panelHTML = await page.$eval('[class*="field-property"], [class*="fx-property"], [class*="property-panel"]', (el) => {
      return el.outerHTML?.substring(0, 3000) || el.innerHTML?.substring(0, 3000) || '';
    }).catch(() => '');

    console.log('[DIAG] 属性面板HTML (前3000字符):');
    console.log(panelHTML);
    console.log('---');

    // 如果有多个属性面板，遍历
    const panels = await page.$$('[class*="field-property"], [class*="fx-property"], [class*="property-panel"]');
    console.log(`\n[DIAG] 属性面板数量: ${panels.length}`);

    for (let i = 0; i < panels.length; i++) {
      const text = await panels[i].innerText().catch(() => '');
      if (text.includes('选择主表')) {
        console.log(`\n[DIAG] 面板[${i}] 包含"选择主表":`);
        console.log(`  文本: ${text.substring(0, 300)}`);

        // 获取这个面板内所有元素的标签和class
        const innerEls = await panels[i].$$eval('*', els => {
          const results: any[] = [];
          for (const el of els) {
            const text = (el.textContent?.trim() || '');
            if (text.includes('选择主表') || text.includes('客户信息') || text.includes('主表')) {
              const tag = el.tagName;
              const cls = (el instanceof HTMLElement) ? el.className?.substring(0, 150) : '';
              const html = (el instanceof HTMLElement) ? el.outerHTML?.substring(0, 400) : '';
              results.push({ tag, class: cls, html });
            }
          }
          return results;
        });
        console.log('  相关元素:');
        innerEls.forEach(el => console.log(`    <${el.tag}> class="${el.class}"\n    html: ${el.html}\n    ---`));
      }
    }

    // 尝试点击"选择主表"所在行
    console.log('\n[DIAG] 尝试点击包含"选择主表"的clickable元素...');

    // 方法1: 找所有可见元素中包含"选择主表"的
    const allVisibleWithSelect = await page.$$eval('[class*="property"] *', els => {
      const results: any[] = [];
      for (const el of els) {
        const text = (el.textContent?.trim() || '');
        if ((text === '选择主表' || text.includes('选择主表')) && el.children.length === 0) {
          const tag = el.tagName;
          const cls = (el instanceof HTMLElement) ? el.className?.substring(0, 150) : '';
          const parentCls = el.parentElement ? (el.parentElement as HTMLElement).className?.substring(0, 150) : '';
          results.push({ tag, class: cls, parentClass: parentCls, text });
        }
      }
      return results;
    });
    console.log('[DIAG] "选择主表"文本元素:');
    allVisibleWithSelect.forEach(el => console.log(`  <${el.tag}> class="${el.class}" parent="${el.parentClass}" text="${el.text}"`));

    await page.screenshot({ path: 'screenshots/diag-property-html.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
