/**
 * Phase 8c - 精确完成聚合表创建
 * 点击 add-btn → 选择表单 → 配置维度/指标 → 保存
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
  console.log('[PHASE 8c - COMPLETE AGGREGATE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click 新建聚合表
    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // ====== Step 1: Click the "添加来源表" button inside the dialog ======
    console.log('Step 1: 点击添加来源表按钮...');
    const addBtn = page.locator('.x-biz-entry-select-combo button.add-btn').first();
    console.log(`  .add-btn 数量: ${await addBtn.count()}`);

    if (await addBtn.count() > 0) {
      await addBtn.click({ force: true });
      await page.waitForTimeout(2000);

      // Check if a dropdown/select appeared
      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log('点击后页面文本:');
      console.log(text.substring(0, 2000));

      await page.screenshot({ path: 'screenshots/master8c-after-addbtn.png', fullPage: true });

      // Check for dropdown/select popover
      const dropdowns = await page.evaluate(() => {
        const selectors = [
          '[class*="dropdown"]', '[class*="select-dropdown"]', '[class*="popover"]',
          '[class*="popper"]', '[class*="menu-list"]', '[class*="option-list"]',
          '.x-biz-dropdown-label', '.x-biz-entry-select-combo',
          '[class*="picker"]', '[class*="selector"]',
        ];
        const results: any[] = [];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          els.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 20) {
              const text = (el as HTMLElement).innerText?.trim()?.substring(0, 200);
              if (text) {
                results.push({
                  selector: sel,
                  text,
                  class: (el as HTMLElement).className?.substring(0, 100),
                  rect: `w:${rect.width.toFixed(0)},h:${rect.height.toFixed(0)}`,
                });
              }
            }
          });
        }
        return results;
      });

      console.log(`\n下拉/弹窗元素 (${dropdowns.length}个):`);
      dropdowns.forEach((d: any) => {
        console.log(`  ${d.selector} "${d.text}" ${d.rect}`);
      });

      // ====== Step 2: Look for form selection options ======
      // Try to find clickable form names
      const formOptions = await page.evaluate(() => {
        return [...document.querySelectorAll('li, [class*="option"], [class*="item"], [class*="entry"]')]
          .filter(el => {
            const text = (el as HTMLElement).innerText?.trim();
            return text && ['客户信息', '产品信息', '订单管理', '订单明细表'].includes(text);
          })
          .map(el => ({
            text: (el as HTMLElement).innerText?.trim(),
            tag: el.tagName,
            class: (el as HTMLElement).className?.substring(0, 100),
          }));
      });

      console.log(`\n表单选项 (${formOptions.length}个):`);
      formOptions.forEach((f: any) => console.log(`  ${f.tag} "${f.text}" class=${f.class}`));

      if (formOptions.length === 0) {
        // Maybe need to click something else to open the form list
        // Try to find the entry-select-combo and see its full structure
        const comboHTML = await page.evaluate(() => {
          const combo = document.querySelector('.x-biz-entry-select-combo');
          return combo ? (combo as HTMLElement).outerHTML?.substring(0, 3000) : 'not found';
        });
        console.log(`\nentry-select-combo HTML:\n${comboHTML}`);
      }

      // Try clicking form options if found
      for (const opt of formOptions) {
        console.log(`\n尝试点击: ${opt.text}`);
        // Find the element and click
        const el = page.locator(`li:has-text("${opt.text}"), [class*="option"]:has-text("${opt.text}")`).first();
        if (await el.count() > 0) {
          await el.click({ force: true });
          await page.waitForTimeout(1500);
          const afterText = await page.locator('body').first().innerText().catch(() => '');
          console.log(`点击后: ${afterText.substring(0, 500)}`);
        }
      }
    }

    // ====== Step 3: Get full page state ======
    console.log('\n====== 当前完整状态 ======');
    const fullText = await page.locator('body').first().innerText().catch(() => '');
    console.log(fullText.substring(0, 3000));

    await page.screenshot({ path: 'screenshots/master8c-final.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
