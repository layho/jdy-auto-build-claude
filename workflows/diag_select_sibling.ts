/**
 * 诊断：找到"选择主表"的下拉组件
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 找"选择主表"的下拉组件...\n');
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

    // 找到"选择主表"label的父元素 config-title，列出所有子元素
    const siblings = await page.evaluate(() => {
      const label = [...document.querySelectorAll('span.label')]
        .find(el => el.textContent?.trim() === '选择主表');
      if (!label) return [];

      const configTitle = label.closest('.config-title') || label.parentElement?.parentElement;
      if (!configTitle) return [];

      // Get all children of config-title
      const children = [...configTitle.children];
      return children.map(child => ({
        tag: child.tagName,
        class: (child as HTMLElement).className?.substring(0, 200),
        text: child.textContent?.trim()?.substring(0, 100),
        html: child.outerHTML?.substring(0, 500),
      }));
    });

    console.log('[DIAG] config-title的子元素:');
    siblings.forEach(s => console.log(JSON.stringify(s, null, 2)));

    // 也看看config-title的父元素
    const parentInfo = await page.evaluate(() => {
      const label = [...document.querySelectorAll('span.label')]
        .find(el => el.textContent?.trim() === '选择主表');
      if (!label) return null;

      const configTitle = label.closest('.config-title');
      if (!configTitle) return null;

      // Get parent and its children
      const parent = configTitle.parentElement;
      if (!parent) return null;

      return {
        parentTag: parent.tagName,
        parentClass: (parent as HTMLElement).className?.substring(0, 200),
        childrenCount: parent.children.length,
        childrenHTML: [...parent.children].map(c => ({
          class: (c as HTMLElement).className?.substring(0, 200),
          html: c.outerHTML?.substring(0, 600),
        })),
      };
    });

    console.log('\n[DIAG] config-title父元素:');
    if (parentInfo) {
      console.log(`  tag: ${parentInfo.parentTag}, class: ${parentInfo.parentClass}`);
      parentInfo.childrenHTML.forEach((c: any, i: number) => {
        console.log(`  child[${i}]: ${c.class}`);
        console.log(`    html: ${c.html}`);
      });
    }

    // 尝试点击 config-title 标签
    console.log('\n[DIAG] 尝试点击 .config-title...');
    const configTitleEl = page.locator('.config-title').filter({ hasText: '选择主表' }).first();
    console.log(`[DIAG] .config-title count: ${await configTitleEl.count()}`);
    if (await configTitleEl.count() > 0) {
      await configTitleEl.click({ force: true });
      await page.waitForTimeout(2000);

      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 点击后:\n${text.substring(0, 2000)}`);
      await page.screenshot({ path: 'screenshots/diag-config-title-click.png', fullPage: true });
    }

    // 也尝试找 "选择主表" label的兄弟元素
    console.log('\n[DIAG] label的兄弟元素...');
    const labelSiblings = await page.evaluate(() => {
      const label = [...document.querySelectorAll('span.label')]
        .find(el => el.textContent?.trim() === '选择主表');
      if (!label) return [];
      const parent = label.parentElement; // title-left
      if (!parent) return [];
      const grandparent = parent.parentElement; // config-title
      if (!grandparent) return [];

      return [...grandparent.children].map(c => ({
        tag: c.tagName,
        class: (c as HTMLElement).className?.substring(0, 200),
        text: c.textContent?.trim()?.substring(0, 100),
        html: c.outerHTML?.substring(0, 500),
      }));
    });

    console.log('[DIAG] config-title的所有子元素:');
    labelSiblings.forEach(s => console.log(JSON.stringify(s, null, 2)));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
