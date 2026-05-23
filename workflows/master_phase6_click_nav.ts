/**
 * Phase 6 - 点击侧边栏导航到各设置页
 * 导航元素是 li.x-navigation-item，需要 click 触发 SPA 路由
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const SETTINGS_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_group';

async function clickNavItem(page: Page, text: string) {
  // The nav items are li.x-navigation-item, click the span with the text
  const item = page.locator('li.x-navigation-item').filter({ hasText: text }).first();
  if (await item.count() > 0) {
    console.log(`  点击: "${text}"`);
    await item.click({ force: true });
    await page.waitForTimeout(2500);
    await waitForStableDOM(page);
    const url = page.url();
    const bodyText = await page.locator('body').first().innerText().catch(() => '');
    const snippet = bodyText.substring(0, 500);
    console.log(`  URL: ${url}`);
    console.log(`  内容: ${snippet}`);
    console.log('');
    return { url, snippet };
  }
  console.log(`  未找到: "${text}"`);
  return null;
}

async function main() {
  console.log('[PHASE 6 - CLICK NAV]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    console.log('当前页面内容:');
    const initialText = await page.locator('body').first().innerText().catch(() => '');
    console.log(initialText.substring(0, 400));
    console.log(`\n初始URL: ${page.url()}\n`);

    // Navigate to each section
    const sections = [
      '跨应用',
      '应用设置',
      '聚合表',
      '计算',
      '智能助手',
      '数据工厂',
      '数据推送',
      '流程分析',
    ];

    for (const section of sections) {
      console.log(`====== ${section} ======`);
      await clickNavItem(page, section);
      await page.screenshot({ path: `screenshots/master6-${section}.png`, fullPage: true });
    }

    console.log('====== Phase 6 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
