/**
 * Phase 1b - 精确定位应用后台入口
 * 分析左侧导航的DOM结构
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
  console.log('[PHASE 1b - NAV ANALYZE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Switch to manage all
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    let text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(500);
      const ma = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await ma.count() > 0) await ma.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // ====== Analyze left pane structure ======
    const leftPane = await page.evaluate(() => {
      const pane = document.querySelector('.left-pane, .app-view-menu, [class*="left-pane"]');
      if (!pane) return { error: 'no left pane' };

      // Find all clickable items in the left pane
      const items = [...pane.querySelectorAll('[class*="menu-item"], [class*="tree-node"], [class*="manage"], li, a, button, span, div')]
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 20 && rect.height > 10;
        })
        .map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 150),
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 100),
          rect: `x:${el.getBoundingClientRect().x.toFixed(0)}, y:${el.getBoundingClientRect().y.toFixed(0)}, w:${el.getBoundingClientRect().width.toFixed(0)}, h:${el.getBoundingClientRect().height.toFixed(0)}`,
          href: (el as HTMLAnchorElement).href || '',
          onclick: (el as HTMLElement).onclick ? 'has onclick' : '',
        }));

      return {
        paneHTML: (pane as HTMLElement).innerHTML?.substring(0, 5000),
        items: items.slice(0, 50),
      };
    });

    console.log(`左侧面板项 (${leftPane.items?.length || 0}个):`);
    (leftPane.items || []).forEach((item: any, i: number) => {
      if (item.text) {
        console.log(`  [${i}] ${item.tag} "${item.text}" ${item.rect} class=${item.class?.substring(0, 80)}`);
      }
    });

    await page.screenshot({ path: 'screenshots/master-1b-leftpane.png', fullPage: true });

    // ====== Try clicking 应用后台 directly ======
    console.log('\n====== 尝试点击应用后台 ======');

    // Method 1: Click the fx-app-menu-manage element
    const manageBtn = page.locator('.fx-app-menu-manage').first();
    const mbCount = await manageBtn.count();
    console.log(`.fx-app-menu-manage: ${mbCount}个`);

    if (mbCount > 0) {
      const rect = await manageBtn.boundingBox().catch(() => null);
      console.log(`  位置: ${JSON.stringify(rect)}`);
      await manageBtn.click({ force: true });
      console.log('  已点击');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const newText = await page.locator('body').first().innerText().catch(() => '');
      console.log(`  点击后页面:\n${newText.substring(0, 1000)}`);
      console.log(`  当前URL: ${page.url()}`);
    }

    await page.screenshot({ path: 'screenshots/master-1b-after-click.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
