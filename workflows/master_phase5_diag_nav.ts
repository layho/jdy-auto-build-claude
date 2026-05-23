/**
 * Phase 5 - 精确诊断设置页导航结构
 * 找到所有可点击的导航元素，捕获其HTML结构和事件
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const SETTINGS_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_group';

async function main() {
  console.log('[PHASE 5 - NAV DIAG]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== 1. Capture ALL HTML of settings area ======
    const settingsHTML = await page.evaluate(() => {
      // Find the main settings container
      const main = document.querySelector('.app-setting, [class*="setting"], .setting-container, .setting-page, .settings');
      if (main) return (main as HTMLElement).innerHTML.substring(0, 5000);

      // Fallback: get the main content area
      const body = document.querySelector('.main-content, .content, [class*="main"], #app');
      if (body) return (body as HTMLElement).innerHTML.substring(0, 8000);

      return document.body.innerHTML.substring(0, 10000);
    });

    console.log('=== 设置页HTML ===');
    console.log(settingsHTML);

    // ====== 2. Find ALL navigation elements with React/Vue event listeners ======
    const navElements = await page.evaluate(() => {
      const results: any[] = [];

      // Look for all elements inside any container
      const allElements = document.querySelectorAll('*');
      const seen = new Set<string>();

      allElements.forEach(el => {
        const text = (el as HTMLElement).innerText?.trim();
        if (!text || text.length > 80) return;

        const tag = el.tagName.toLowerCase();
        const cls = (el as HTMLElement).className?.toString() || '';

        // Only capture clickable or list-like elements
        const isClickable = tag === 'a' || tag === 'button' ||
          cls.includes('item') || cls.includes('menu') || cls.includes('nav') ||
          cls.includes('tab') || cls.includes('link') || cls.includes('click') ||
          el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link' ||
          el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'menuitem';

        if (!isClickable) return;

        const key = `${tag}:${text}:${cls.substring(0, 40)}`;
        if (seen.has(key)) return;
        seen.add(key);

        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 10) return;

        results.push({
          tag,
          text: text.substring(0, 60),
          class: cls.substring(0, 120),
          id: el.id || '',
          role: el.getAttribute('role') || '',
          href: (el as HTMLAnchorElement).href || '',
          rect: `x:${rect.x.toFixed(0)},y:${rect.y.toFixed(0)},w:${rect.width.toFixed(0)},h:${rect.height.toFixed(0)}`,
          dataset: JSON.stringify((el as HTMLElement).dataset),
        });
      });

      return results;
    });

    console.log(`\n=== 导航元素 (${navElements.length}个) ===`);
    navElements.forEach((el: any) => {
      console.log(`  ${el.tag} "${el.text}" ${el.rect} class=${el.class?.substring(0, 60)}`);
    });

    // ====== 3. Find the SIDEBAR navigation specifically ======
    const sidebarNav = await page.evaluate(() => {
      // Common sidebar patterns in Vue/React admin panels
      const selectors = [
        '.el-menu', '.el-menu-item', '.el-submenu',
        '.ant-menu', '.ant-menu-item',
        '.sidebar-menu', '.side-menu', '.left-menu',
        '[class*="side-nav"]', '[class*="sidenav"]',
        '.setting-nav', '.setting-menu', '.setting-sidebar',
        'nav', 'aside',
        '.tabs-nav', '.tab-nav',
        '[class*="left-nav"]',
        '.fx-setting-nav', '.fx-setting-menu',
      ];

      const results: Record<string, any> = {};
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          results[sel] = [...els].slice(0, 10).map(el => ({
            html: (el as HTMLElement).outerHTML.substring(0, 500),
            rect: JSON.stringify(el.getBoundingClientRect()),
          }));
        }
      }
      return results;
    });

    console.log('\n=== 侧边栏匹配 ===');
    for (const [sel, matches] of Object.entries(sidebarNav)) {
      console.log(`  ${sel}: ${(matches as any[]).length}个`);
      (matches as any[]).forEach((m: any) => {
        console.log(`    rect=${m.rect} html=${m.html?.substring(0, 200)}`);
      });
    }

    // ====== 4. Try to find the exact nav through URL change observation ======
    console.log('\n=== 尝试逐个点击导航链接 ===');

    // Get all <a> tags in the settings area
    const links = await page.evaluate(() => {
      return [...document.querySelectorAll('a')]
        .filter(a => {
          const text = a.innerText?.trim();
          const rect = a.getBoundingClientRect();
          return text && text.length > 1 && rect.width > 30;
        })
        .map(a => ({
          text: a.innerText?.trim()?.substring(0, 60),
          href: a.getAttribute('href') || '',
          class: a.className?.substring(0, 80),
          rect: `x:${a.getBoundingClientRect().x.toFixed(0)},y:${a.getBoundingClientRect().y.toFixed(0)}`,
        }));
    });

    console.log(`链接 (${links.length}个):`);
    links.forEach((l: any) => console.log(`  "${l.text}" href=${l.href} ${l.rect}`));

    // ====== 5. Click each sidebar link and observe URL ======
    for (const link of links) {
      if (!link.text || link.text.length < 2) continue;
      const before = page.url();
      try {
        const el = page.locator('a').filter({ hasText: link.text }).first();
        if (await el.count() > 0) {
          await el.click({ force: true, timeout: 3000 });
          await page.waitForTimeout(2000);
          const after = page.url();
          if (before !== after) {
            console.log(`  ✓ "${link.text}" → URL变化: ${after}`);
          } else {
            console.log(`  - "${link.text}" → URL未变`);
          }
        }
      } catch {
        // skip
      }
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
