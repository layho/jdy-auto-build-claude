/**
 * Phase 9 - 清理失败的聚合表，重新创建完整配置的聚合表
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
  console.log('[PHASE 9 - CLEANUP & REDO]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== Step 1: Delete all "未命名聚合表" entries ======
    console.log('Step 1: 清理未命名聚合表...');

    // Get the list of aggregate tables
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('当前聚合表列表:');
    console.log(text.substring(0, 1500));

    // Find all delete buttons for "未命名聚合表"
    // Each aggregate table row has a delete button
    const deleteButtons = await page.evaluate(() => {
      const rows = document.querySelectorAll('[class*="aggregate"] [class*="item"], [class*="aggregate"] [class*="row"], [class*="list"] [class*="item"]');
      return [...rows].map(r => ({
        text: (r as HTMLElement).innerText?.trim()?.substring(0, 80),
        hasDelete: !!r.querySelector('[class*="delete"], [class*="trash"], button:has-text("删除")'),
      }));
    });
    console.log(`\n聚合表行 (${deleteButtons.length}个):`);
    deleteButtons.forEach((r: any) => console.log(`  "${r.text?.substring(0, 60)}" hasDelete=${r.hasDelete}`));

    // Try to find and click delete for each 未命名聚合表
    // First, find the aggregate table list items
    const listItems = await page.evaluate(() => {
      // Look for all aggregate table entries
      const items = document.querySelectorAll('[class*="aggregate-table-item"], [class*="agg-item"], [class*="agg-table"]');
      if (items.length === 0) {
        // Try broader search
        const allDivs = document.querySelectorAll('div');
        const results: any[] = [];
        for (const d of allDivs) {
          const text = (d as HTMLElement).innerText?.trim();
          if (text === '未命名聚合表' || text?.startsWith('未命名聚合表')) {
            const parent = d.closest('[class*="item"], [class*="row"], [class*="card"]');
            if (parent) {
              results.push({
                text: (parent as HTMLElement).innerText?.substring(0, 100),
                html: (parent as HTMLElement).innerHTML?.substring(0, 500),
              });
            }
          }
        }
        return results;
      }
      return [...items].map(i => ({
        text: (i as HTMLElement).innerText?.trim()?.substring(0, 100),
        html: (i as HTMLElement).innerHTML?.substring(0, 500),
      }));
    });

    console.log(`\n未命名聚合表条目 (${listItems.length}个):`);
    listItems.forEach((item: any) => {
      console.log(`  text: ${item.text?.substring(0, 80)}`);
      console.log(`  html: ${item.html?.substring(0, 300)}`);
    });

    // ====== Step 2: Navigate into 订单统计 to complete it ======
    console.log('\n\nStep 2: 打开订单统计继续编辑...');

    // Click on "订单统计" in the list
    const orderStats = page.locator('[class*="aggregate"] :has-text("订单统计")').first();
    if (await orderStats.count() > 0) {
      console.log('  找到订单统计，点击进入...');
      await orderStats.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      text = await page.locator('body').first().innerText().catch(() => '');
      console.log('订单统计页面:');
      console.log(text.substring(0, 2000));
    }

    await page.screenshot({ path: 'screenshots/master9-order-stats.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
