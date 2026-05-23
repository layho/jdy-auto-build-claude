/**
 * 诊断：点击关联子表widget后到底发生了什么
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
  console.log('[DIAG WIDGET CLICK]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // 进入编辑器
    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 先看当前状态
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`点击前字段: ${fields.join(' | ')}`);

    // 检查widget的HTML结构
    const widgetHTML = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('li.form-edit-widget-label')];
      const subTable = labels.find(el => el.textContent?.includes('关联子表'));
      if (!subTable) return null;
      return {
        outerHTML: subTable.outerHTML.substring(0, 1000),
        rect: JSON.stringify(subTable.getBoundingClientRect()),
        class: subTable.className,
        // Check parent container
        parentClass: subTable.parentElement?.className?.substring(0, 200),
        parentScrollTop: subTable.parentElement?.scrollTop,
        parentScrollHeight: subTable.parentElement?.scrollHeight,
        parentClientHeight: subTable.parentElement?.clientHeight,
      };
    });
    console.log(`Widget HTML: ${JSON.stringify(widgetHTML, null, 2)}`);

    // 尝试不同的方式点击
    const subTableWidget = page.locator('li.form-edit-widget-label').filter({ hasText: '关联子表' }).first();

    // 先尝试用 dispatchEvent
    console.log('\n尝试 dispatchEvent click...');
    await subTableWidget.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(2000);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`dispatchEvent后 dialog: ${text.includes('添加关联子表')}`);

    // 检查字段变化
    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`dispatchEvent后字段: ${fields.join(' | ')}`);

    // 尝试用 evaluate 直接触发
    console.log('\n尝试 evaluate click...');
    await page.evaluate(() => {
      const labels = [...document.querySelectorAll('li.form-edit-widget-label')];
      const subTable = labels.find(el => el.textContent?.includes('关联子表'));
      if (subTable) {
        (subTable as HTMLElement).click();
      }
    });
    await page.waitForTimeout(2000);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`evaluate后 dialog: ${text.includes('添加关联子表')}`);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`evaluate后字段: ${fields.join(' | ')}`);

    // 检查页面上所有dialog/modal
    const allDialogs = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="dialog"], [class*="modal"], [class*="drawer"], [class*="popup"], [class*="mask"]')]
        .filter(el => (el as HTMLElement).offsetHeight > 0)
        .map(el => ({
          class: (el as HTMLElement).className?.substring(0, 150),
          rect: JSON.stringify(el.getBoundingClientRect()),
          text: (el.textContent || '').trim().substring(0, 200),
        }));
    });
    console.log(`\n页面上的dialog/modal: ${allDialogs.length}个`);
    allDialogs.forEach((d, i) => {
      console.log(`  [${i}] class="${d.class}"`);
      console.log(`       text="${d.text}"`);
    });

    // 看看"表单属性"面板中是否有"添加关联子表"
    text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('添加关联子表')) {
      console.log(`\n找到"添加关联子表"文本:\n${text.substring(text.indexOf('添加关联子表'), text.indexOf('添加关联子表') + 500)}`);
    }

    await page.screenshot({ path: 'screenshots/diag-widget-click.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
