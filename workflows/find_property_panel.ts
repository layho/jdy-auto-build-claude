/**
 * 找到编辑器中的属性面板 - 全页扫描
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
  console.log('[FIND PROPERTY PANEL]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

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
    console.log('✓ 已进入编辑器');

    // Click order detail field
    const orderDetailField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    await orderDetailField.click({ force: true });
    console.log('✓ 已点击订单明细字段');
    await page.waitForTimeout(2000);

    // Full page scan for right-side panels
    const rightPanels = await page.evaluate(() => {
      // Find all elements on the right side (x > 60% of page width)
      const w = window.innerWidth;
      const threshold = w * 0.6;
      const all = [...document.querySelectorAll('*')];

      // Find large containers on the right side
      const rightContainers = all
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.x > threshold && rect.width > 100 && rect.height > 100;
        })
        .map(el => ({
          tag: el.tagName,
          id: el.id,
          class: (el as HTMLElement).className?.substring(0, 200),
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 300),
          rect: JSON.stringify(el.getBoundingClientRect()),
        }))
        .filter(item => item.text.length > 5);

      return rightContainers.slice(0, 20);
    });

    console.log(`\n右侧面板 (x > 60%):`);
    rightPanels.forEach((p, i) => console.log(`  [${i}] ${p.tag} .${p.class?.substring(0, 60)}\n      rect=${p.rect}\n      text="${p.text?.substring(0, 200)}"\n`));

    // Also look for the overall page structure
    const layout = await page.evaluate(() => {
      const mainAreas = [...document.querySelectorAll('[class*="layout"], [class*="panel"], [class*="aside"], [class*="side"], [class*="right"]')];
      return mainAreas
        .filter(el => el.getBoundingClientRect().width > 100 && el.getBoundingClientRect().height > 100)
        .map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 150),
          rect: JSON.stringify(el.getBoundingClientRect()),
        }));
    });

    console.log(`\n页面布局区域:`);
    layout.forEach(l => console.log(`  ${l.tag} .${l.class?.substring(0, 80)} rect=${l.rect}`));

    await page.screenshot({ path: 'screenshots/find-panel.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
