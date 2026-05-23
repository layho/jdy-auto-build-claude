/**
 * Phase 19 - 点击+号添加智能助手动作，找到仪表盘创建入口
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
  console.log('[PHASE 19 - ADD ACTION & DASHBOARD]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Click the + icon on the canvas ======
    console.log('====== 1. 添加动作节点 ======');
    await page.goto(SMART_EDIT_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(5000);

    // Click the fx-automation-design-plus-icon
    const plusIcon = page.locator('.fx-automation-design-plus-icon').first();
    console.log(`  plus icon: ${await plusIcon.count()}个`);

    if (await plusIcon.count() > 0) {
      await plusIcon.click({ force: true });
      await page.waitForTimeout(3000);
      console.log('  ✓ 点击了 + 图标');
    }

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('点击+后:');
    console.log(text.substring(0, 2000));

    await page.screenshot({ path: 'screenshots/master19-add-action.png', fullPage: true });

    // Check for action type selector
    const actionTypes = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="menu"], [class*="action-list"], [class*="selector"], [class*="popover"]')]
        .filter(el => {
          const text = (el as HTMLElement).innerText?.trim();
          return text && (text.includes('新增') || text.includes('修改') || text.includes('删除') || text.includes('查询'));
        })
        .map(el => ({
          class: (el as HTMLElement).className?.substring(0, 100),
          text: (el as HTMLElement).innerText?.substring(0, 1000),
        }));
    });

    console.log('\n动作类型选择器:');
    actionTypes.forEach((a: any) => {
      console.log(`[${a.class}]:`);
      console.log(a.text?.substring(0, 500));
    });

    // Look for the node config drawer content
    const drawerContent = await page.evaluate(() => {
      const drawer = document.querySelector('.fx-automation-node-config-drawer');
      return drawer ? (drawer as HTMLElement).innerHTML?.substring(0, 5000) : 'no drawer';
    });
    console.log('\nDrawer HTML:');
    console.log(drawerContent?.substring(0, 3000));

    // ====== 2. Find dashboard creation ======
    console.log('\n\n====== 2. 查找仪表盘创建入口 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Enter manage all mode
    text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(800);
      const ma = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await ma.count() > 0) await ma.click({ force: true });
      await page.waitForTimeout(1500);
    }

    // Look for create/new buttons
    const allBtns = await page.evaluate(() => {
      return [...document.querySelectorAll('button, [role="button"]')]
        .filter(b => b.getBoundingClientRect().width > 20)
        .map(b => ({
          text: (b as HTMLElement).innerText?.trim()?.substring(0, 60),
          class: (b as HTMLElement).className?.substring(0, 80),
        }))
        .filter(b => b.text && b.text.length > 1);
    });

    const uniqueBtns = [...new Set(allBtns.map(b => b.text))];
    console.log('可见按钮:');
    uniqueBtns.forEach(b => console.log(`  "${b}"`));

    // Look for the app header/add button
    const headerArea = await page.evaluate(() => {
      const header = document.querySelector('.app-view-header, [class*="app-header"], [class*="view-header"]');
      return header ? (header as HTMLElement).innerHTML?.substring(0, 3000) : 'no header';
    });
    console.log('\nApp header HTML:');
    console.log(headerArea?.substring(0, 2000));

    // Check if there's a "新建" menu in the app view
    const createMenu = page.locator('[class*="create"], [class*="add-new"], :has-text("新建仪表盘"), :has-text("新建表单")').first();
    console.log(`\n创建菜单: ${await createMenu.count()}个`);

    // Try the app management page - maybe dashboards are managed there
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\nApp home:');
    console.log(text.substring(0, 1000));

    await page.screenshot({ path: 'screenshots/master19-dashboard-find.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
