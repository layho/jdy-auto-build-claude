/**
 * Phase 3 - 精确导航侧边栏
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_SETTINGS_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_group';

async function main() {
  console.log('[PHASE 3 - PRECISE NAV]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_SETTINGS_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Analyze the sidebar structure
    const sidebarAnalysis = await page.evaluate(() => {
      // Find the sidebar/left pane
      const sidebar = document.querySelector('[class*="sidebar"], [class*="left"], [class*="nav"], [class*="aside"]');
      if (!sidebar) return { error: 'no sidebar found', allNav: document.body.innerHTML?.substring(0, 3000) };

      // Get all anchor elements
      const links = [...sidebar.querySelectorAll('a')].map(a => ({
        tag: 'A',
        text: a.innerText?.trim()?.substring(0, 60),
        href: a.getAttribute('href') || '',
        class: a.className?.substring(0, 80),
      }));

      // Get all list items
      const listItems = [...sidebar.querySelectorAll('li')].map(li => ({
        tag: 'LI',
        text: li.innerText?.trim()?.substring(0, 60),
        class: li.className?.substring(0, 80),
      }));

      // Get all elements with specific text patterns
      const allSpans = [...sidebar.querySelectorAll('span, div')]
        .filter(el => {
          const text = (el as HTMLElement).innerText?.trim();
          return text && ['聚合表','智能助手','数据工厂','数据推送','流程分析','计算','应用设置','表单','跨应用','高级功能'].some(k => text === k);
        })
        .map(el => ({
          tag: el.tagName,
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 60),
          class: (el as HTMLElement).className?.substring(0, 100),
          rect: JSON.stringify(el.getBoundingClientRect()),
        }));

      return {
        links,
        listItems,
        matchedElements: allSpans,
        sidebarHTML: (sidebar as HTMLElement).innerHTML?.substring(0, 5000),
      };
    });

    console.log(`链接 (${sidebarAnalysis.links?.length || 0}个):`);
    (sidebarAnalysis.links || []).forEach((l: any) => {
      if (l.text) console.log(`  A "${l.text}" href=${l.href}`);
    });

    console.log(`\n匹配元素 (${sidebarAnalysis.matchedElements?.length || 0}个):`);
    (sidebarAnalysis.matchedElements || []).forEach((m: any) => {
      console.log(`  ${m.tag} "${m.text}" ${m.rect}`);
    });

    console.log(`\n侧边栏HTML (前2000字符):\n${sidebarAnalysis.sidebarHTML?.substring(0, 2000)}`);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
