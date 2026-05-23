/**
 * 诊断：点击子表"添加"按钮后的DOM变化
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
  console.log('[DIAG SUBTABLE AFTER ADD]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 打开表单
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

    // 检查子表当前HTML
    const beforeAdd = await page.evaluate(() => {
      const btnAdd = document.querySelector('button.btn-add');
      if (!btnAdd) return { error: 'no btn-add' };

      // 向上找子表容器
      let subtableContainer = btnAdd.parentElement;
      for (let i = 0; i < 10 && subtableContainer; i++) {
        const cls = String(subtableContainer.className || '');
        if (cls.includes('subtable') || cls.includes('relatedform') || cls.includes('related-form') ||
            cls.includes('child-table') || cls.includes('childtable')) {
          break;
        }
        subtableContainer = subtableContainer.parentElement;
      }

      // 找表单内包含"订单明细"的field
      const form = document.querySelector('.fx-form.form-modal');
      const allFields = [...(form?.querySelectorAll('[data-widgetname]') || [])];
      const subtableField = allFields.find(el => (el as HTMLElement).innerText?.includes('订单明细'));

      return {
        containerTag: subtableContainer?.tagName,
        containerClass: (subtableContainer as HTMLElement)?.className?.substring(0, 200),
        containerHTML: subtableContainer?.outerHTML?.substring(0, 3000),
        subtableFieldHTML: subtableField?.outerHTML?.substring(0, 2000),
      };
    });

    console.log(`点击前:\n${JSON.stringify(beforeAdd, null, 2).substring(0, 3000)}`);

    // 点击btn-add
    const subAddBtn = page.locator('button.btn-add').first();
    if (await subAddBtn.count() > 0) {
      await subAddBtn.click({ force: true });
      console.log('\n✓ 已点击btn-add');
      await page.waitForTimeout(2500);
    }

    // 检查点击后的DOM
    const afterAdd = await page.evaluate(() => {
      const btnAdd = document.querySelector('button.btn-add');
      if (!btnAdd) return { error: 'no btn-add' };

      let subtableContainer = btnAdd.parentElement;
      for (let i = 0; i < 10 && subtableContainer; i++) {
        const cls = String(subtableContainer.className || '');
        if (cls.includes('subtable') || cls.includes('relatedform') || cls.includes('related-form') ||
            cls.includes('child-table') || cls.includes('childtable')) {
          break;
        }
        subtableContainer = subtableContainer.parentElement;
      }

      const form = document.querySelector('.fx-form.form-modal');
      const allFields = [...(form?.querySelectorAll('[data-widgetname]') || [])];
      const subtableField = allFields.find(el => (el as HTMLElement).innerText?.includes('订单明细'));

      // 找所有新出现的input
      const allInputs = [...document.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"]')];

      return {
        containerHTML: subtableContainer?.outerHTML?.substring(0, 4000),
        subtableFieldInnerText: (subtableField as HTMLElement)?.innerText?.trim(),
        newInputs: allInputs.filter(inp => {
          const rect = inp.getBoundingClientRect();
          return rect.y > 300; // 子表区域在下方
        }).map(inp => ({
          tag: inp.tagName,
          type: (inp as HTMLInputElement).type,
          class: (inp as HTMLElement).className?.substring(0, 80),
          rect: JSON.stringify(inp.getBoundingClientRect()),
        })),
      };
    });

    console.log(`\n点击后:\n${JSON.stringify(afterAdd, null, 2).substring(0, 4000)}`);

    await page.screenshot({ path: 'screenshots/diag-subtable-after-add.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
