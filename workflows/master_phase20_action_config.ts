/**
 * Phase 20 - 选择智能助手动作 + 创建仪表盘
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const SMART_EDIT_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/automation/6a110c3d63fbb50f9e104db2/edit';

async function main() {
  console.log('[PHASE 20 - ACTION CONFIG & DASHBOARD]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Click 新增数据 ======
    console.log('====== 1. 选择"新增数据"动作 ======');
    await page.goto(SMART_EDIT_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(5000);

    // Click the + icon
    await page.locator('.fx-automation-design-plus-icon').first().click({ force: true });
    await page.waitForTimeout(2000);

    // Click 新增数据
    const addDataBtn = page.locator('[class*="popover"] :has-text("新增数据")').first();
    console.log(`  新增数据: ${await addDataBtn.count()}个`);
    if (await addDataBtn.count() > 0) {
      await addDataBtn.click({ force: true });
      await page.waitForTimeout(4000);
      await waitForStableDOM(page);
      console.log('  ✓ 选择了新增数据');
    }

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n选择新增数据后:');
    console.log(text.substring(0, 2500));

    await page.screenshot({ path: 'screenshots/master20-action-selected.png', fullPage: true });

    // Check the drawer content now
    const drawerContent = await page.evaluate(() => {
      const drawer = document.querySelector('.fx-automation-node-config-drawer');
      return drawer ? (drawer as HTMLElement).innerHTML?.substring(0, 5000) : 'no drawer';
    });
    console.log('\nDrawer HTML:');
    console.log(drawerContent?.substring(0, 4000));

    // ====== 2. Create a dashboard ======
    console.log('\n\n====== 2. 创建仪表盘 ======');

    // Try the app management page with a focus on dashboards
    // Maybe dashboards are created from the form/page list
    await page.goto('https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Enter manage all
    text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(800);
      const ma = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await ma.count() > 0) await ma.click({ force: true });
      await page.waitForTimeout(1500);
    }

    // Look for "新建" link/button near the app name/header
    // The left sidebar might have a "+" or "新建" at the top
    const sidebarTop = await page.evaluate(() => {
      const sidebar = document.querySelector('.left-pane, .app-view-menu, [class*="left-pane"]');
      if (!sidebar) return null;
      // Get the header area
      const header = sidebar.querySelector('[class*="header"], [class*="title"], [class*="top"]');
      return {
        hasHeader: !!header,
        headerHTML: header ? (header as HTMLElement).innerHTML?.substring(0, 2000) : '',
        sidebarTop: (sidebar as HTMLElement).innerHTML?.substring(0, 3000),
      };
    });
    console.log('Sidebar top:');
    console.log(sidebarTop?.sidebarTop?.substring(0, 2000));

    // Look for any element with "新建" text in the sidebar
    const newBtn = page.locator('.left-pane :has-text("新建"), .app-view-menu :has-text("新建"), [class*="left"] :has-text("新建")').first();
    console.log(`\n新建按钮: ${await newBtn.count()}个`);

    // Try the fx-app-menu-manage button (应用后台)
    const appMgmtBtn = page.locator('.fx-app-menu-manage').first();
    console.log(`应用后台按钮: ${await appMgmtBtn.count()}个`);

    // Actually, let me look at the app view more carefully
    // The app might have a tab bar with 表单 | 仪表盘
    const tabBar = await page.evaluate(() => {
      const tabs = document.querySelectorAll('[class*="tab"], [class*="nav-item"]');
      return [...tabs].map(t => ({
        text: (t as HTMLElement).innerText?.trim()?.substring(0, 40),
        class: (t as HTMLElement).className?.substring(0, 80),
      }));
    });
    console.log(`\nTab bar (${tabBar.length}个):`);
    tabBar.forEach(t => console.log(`  "${t.text}"`));

    await page.screenshot({ path: 'screenshots/master20-app-view.png', fullPage: true });

    // ====== 3. Try creating a dashboard from a different entry ======
    console.log('\n\n====== 3. 尝试其他仪表盘入口 ======');
    // Maybe the app list page has dashboard creation
    await page.goto('https://www.jiandaoyun.com/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('Dashboard主页:');
    console.log(text.substring(0, 1000));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
