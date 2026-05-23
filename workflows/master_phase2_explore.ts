/**
 * Phase 2 - 全面探索应用后台各功能模块
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_SETTINGS_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_group';

async function exploreTab(page: Page, tabName: string, tabSelector: string) {
  console.log(`\n====== ${tabName} ======`);
  const tab = page.locator(tabSelector).first();
  if (await tab.count() > 0 && await tab.isVisible().catch(() => false)) {
    await tab.click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(text.substring(0, 1500));
    await page.screenshot({ path: `screenshots/master2-${tabName.replace(/\//g,'-')}.png`, fullPage: true });
    return true;
  }
  console.log(`  未找到 tab: ${tabSelector}`);
  return false;
}

async function main() {
  console.log('[PHASE 2 - EXPLORE ALL FEATURES]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Go to app settings
    await page.goto(APP_SETTINGS_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    console.log(`当前URL: ${page.url()}`);

    // Get all settings tabs
    const tabs = await page.evaluate(() => {
      const tabEls = [...document.querySelectorAll('[class*="tab"], [class*="nav-item"], [class*="menu-item"], [class*="sidebar"] [class*="item"]')];
      return tabEls
        .filter(el => (el as HTMLElement).innerText?.trim())
        .map(el => ({
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 80),
          class: (el as HTMLElement).className?.substring(0, 100),
          rect: JSON.stringify(el.getBoundingClientRect()),
        }));
    });

    console.log(`设置页Tab (${tabs.length}个):`);
    tabs.forEach(t => console.log(`  "${t.text}" ${t.rect}`));

    // Navigate to each major section
    // 1. 应用设置
    await exploreTab(page, '应用设置', ':has-text("应用设置"):not(:has-text("表单"))');

    // 2. 表单/仪表盘权限
    await exploreTab(page, '表单权限', ':has-text("表单/仪表盘权限")');

    // 3. 跨应用
    await exploreTab(page, '跨应用', ':has-text("跨应用")');

    // 4. 聚合表
    await exploreTab(page, '聚合表', ':has-text("聚合表"):not(:has-text("权限"))');

    // 5. 智能助手
    await exploreTab(page, '智能助手', ':has-text("智能助手")');

    // 6. 数据工厂
    await exploreTab(page, '数据工厂', ':has-text("数据工厂")');

    // 7. 数据推送
    await exploreTab(page, '数据推送', ':has-text("数据推送")');

    console.log('\n====== Phase 2 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
