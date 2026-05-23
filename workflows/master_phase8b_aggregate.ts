/**
 * Phase 8b - 完成聚合表创建
 * 选择数据源 → 配置维度/指标 → 保存
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const AGGREGATE_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_aggregate';

async function main() {
  console.log('[PHASE 8b - COMPLETE AGGREGATE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click 新建聚合表
    const createBtn = page.locator('button:has-text("新建聚合表"), span:has-text("新建聚合表")').first();
    await createBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Step 1: Click 添加来源表 ======
    console.log('Step 1: 添加数据来源表');
    const addSourceBtn = page.locator('button:has-text("添加来源表"), span:has-text("添加来源表"), :has-text("添加来源表")').first();
    console.log(`  添加来源表按钮: ${await addSourceBtn.count()}个`);

    if (await addSourceBtn.count() > 0) {
      await addSourceBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // Check what dialogs/popups appear
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('点击添加来源表后:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master8b-add-source.png', fullPage: true });

    // ====== Step 2: Look for form selector ======
    // Try to find form list / selector
    const formSelector = page.locator('[class*="source-select"], [class*="form-select"], [class*="table-select"], .fx-aggregate-source-select-dialog');
    if (await formSelector.count() > 0) {
      console.log('\n查找表单选择器...');

      // Get all checkboxes or selectable items
      const items = await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"], [class*="checkbox"], [class*="check"]');
        const result: any[] = [];
        checkboxes.forEach(cb => {
          const parent = cb.closest('label, div, li');
          const text = parent ? (parent as HTMLElement).innerText?.trim()?.substring(0, 80) : '';
          if (text && text.length > 1) {
            result.push({
              text,
              checked: (cb as HTMLInputElement).checked,
              class: (cb as HTMLElement).className?.substring(0, 60),
            });
          }
        });
        return result;
      });

      console.log(`  可选表单 (${items.length}个):`);
      items.forEach((item: any) => console.log(`    ${item.checked ? '☑' : '☐'} "${item.text}"`));

      // Also check for any tree/select list
      const listItems = await page.evaluate(() => {
        return [...document.querySelectorAll('[class*="select"] li, [class*="list"] li, [class*="tree"] li, [class*="option"]')]
          .slice(0, 20)
          .map(li => ({
            text: (li as HTMLElement).innerText?.trim()?.substring(0, 80),
            class: (li as HTMLElement).className?.substring(0, 80),
          }));
      });
      console.log(`\n  列表项 (${listItems.length}个):`);
      listItems.forEach((li: any) => console.log(`    "${li.text}"`));
    }

    // ====== Step 3: Try to select forms from the dialog ======
    // The dialog might have a different structure - let's check all text content
    const fullDialogs = await page.evaluate(() => {
      return [...document.querySelectorAll('.fx-aggregate-source-select-dialog, .source-select-dialog-content, .dialog-content')]
        .map(d => ({
          class: (d as HTMLElement).className?.substring(0, 100),
          html: (d as HTMLElement).innerHTML?.substring(0, 5000),
        }));
    });

    for (const d of fullDialogs) {
      console.log(`\n=== Dialog: ${d.class} ===`);
      console.log(d.html?.substring(0, 4000));
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
