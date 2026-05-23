/**
 * Phase 18 - 智能助手添加动作节点 + 探索仪表盘入口
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const SMART_EDIT_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/automation/6a110c3d63fbb50f9e104db2/edit';
const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[PHASE 18 - FINAL EXPLORE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Smart Assistant - find and click + button ======
    console.log('====== 1. 智能助手 - 添加动作 ======');
    await page.goto(SMART_EDIT_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(5000);

    // Look for the add button on the canvas
    const canvasElements = await page.evaluate(() => {
      const results: any[] = [];
      // Find all clickable elements on the canvas
      const allEls = document.querySelectorAll('[class*="add"], [class*="plus"], [class*="node-action"], [class*="insert"]');
      allEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) {
          results.push({
            tag: el.tagName,
            class: (el as HTMLElement).className?.substring(0, 100),
            text: (el as HTMLElement).innerText?.trim()?.substring(0, 50),
            rect: `x:${rect.x.toFixed(0)},y:${rect.y.toFixed(0)},w:${rect.width.toFixed(0)},h:${rect.height.toFixed(0)}`,
          });
        }
      });
      return results;
    });

    console.log(`可添加元素 (${canvasElements.length}个):`);
    canvasElements.forEach((e: any) => console.log(`  ${e.tag} "${e.text}" ${e.rect} class=${e.class}`));

    // Try clicking the + button between nodes
    const addBtn = page.locator('[class*="add-node"], [class*="insert-node"], [class*="node-add"]').first();
    if (await addBtn.count() > 0) {
      await addBtn.click({ force: true });
      await page.waitForTimeout(3000);
      console.log('✓ 点击了添加按钮');
    }

    // Also try clicking near the middle of the canvas
    const canvasCenter = await page.evaluate(() => {
      const canvas = document.querySelector('[class*="canvas"], [class*="flow"], [class*="graph"]');
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });

    if (canvasCenter) {
      console.log(`\nCanvas中心: ${JSON.stringify(canvasCenter)}`);
      // Click on the line between 订单管理 and 未设置
      await page.mouse.click(canvasCenter.x, canvasCenter.y - 50);
      await page.waitForTimeout(3000);
    }

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n点击后:');
    console.log(text.substring(0, 2000));

    // Check for any new panels
    const panels = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="dialog"]:not([style*="display: none"]), [class*="panel"]:not([style*="display: none"]), [class*="drawer"]')]
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 100 && rect.height > 100;
        })
        .map(el => ({
          class: (el as HTMLElement).className?.substring(0, 120),
          text: (el as HTMLElement).innerText?.substring(0, 1000),
        }));
    });
    console.log('\n可见面板:');
    panels.forEach((p: any) => {
      console.log(`\n[${p.class}]:`);
      console.log(p.text?.substring(0, 500));
    });

    await page.screenshot({ path: 'screenshots/master18-automation.png', fullPage: true });

    // ====== 2. Explore dashboard in app nav ======
    console.log('\n\n====== 2. 仪表盘入口 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Make sure we're in manage all mode
    text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(800);
      const ma = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await ma.count() > 0) await ma.click({ force: true });
      await page.waitForTimeout(1500);
    }

    // Check left nav for dashboard link
    const navItems = await page.evaluate(() => {
      const nav = document.querySelector('.left-pane, .app-view-menu, [class*="left-pane"], [class*="sidebar"]');
      if (!nav) return [];
      return [...nav.querySelectorAll('li, a, [class*="item"], [class*="node"]')]
        .filter(el => (el as HTMLElement).innerText?.trim())
        .map(el => ({
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 60),
          class: (el as HTMLElement).className?.substring(0, 80),
          href: (el as HTMLAnchorElement).href || '',
        }));
    });

    console.log(`导航项 (${navItems.length}个):`);
    navItems.forEach((n: any) => {
      if (n.text && n.text.length > 1) {
        console.log(`  "${n.text}" href=${n.href} class=${n.class?.substring(0, 60)}`);
      }
    });

    // Look for 仪表盘 in the navigation
    const dashNav = page.locator(':has-text("仪表盘")').first();
    console.log(`\n仪表盘导航: ${await dashNav.count()}个`);
    if (await dashNav.count() > 0) {
      await dashNav.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      text = await page.locator('body').first().innerText().catch(() => '');
      console.log('仪表盘页面:');
      console.log(text.substring(0, 1500));
      console.log(`URL: ${page.url()}`);
    }

    await page.screenshot({ path: 'screenshots/master18-dashboard-nav.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
