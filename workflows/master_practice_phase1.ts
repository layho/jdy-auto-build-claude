/**
 * Master Practice - 全面实践简道云各模块
 *
 * Phase 1: 进入应用管理，创建流程表单
 * Phase 2: 配置审批流程
 * Phase 3: 创建仪表盘
 * Phase 4: 创建聚合表
 */

import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';
const APP_ID = '6a0aa9d82c4789aa80588d06';

async function clickIfVisible(page: Page, selector: string, label: string): Promise<boolean> {
  const el = page.locator(selector).first();
  if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
    await el.click({ force: true });
    console.log(`  ✓ 点击: ${label}`);
    return true;
  }
  return false;
}

async function main() {
  console.log('[MASTER PRACTICE PHASE 1]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Step 1: Navigate to app with full permissions ======
    console.log('====== Step 1: 切换到管理全部数据 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // 先进入订单管理（这个有管理全部数据权限）
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`当前模式: ${text.includes('仅添加数据') ? '仅添加数据' : text.includes('管理全部数据') ? '管理全部数据' : '未知'}`);

    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(800);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(1500);
      console.log('✓ 已切换到管理全部数据');
    }

    await page.screenshot({ path: 'screenshots/master-1-manageall.png', fullPage: true });

    // ====== Step 2: Find app management / create new form ======
    console.log('\n====== Step 2: 查找新建表单入口 ======');

    // Look for app management area
    const appMgmt = page.locator('.fx-app-menu-manage, [class*="app-back"], :has-text("应用后台")');
    const amCount = await appMgmt.count();
    console.log(`应用管理入口: ${amCount}个`);

    // Click 应用后台 if visible
    for (let i = 0; i < amCount; i++) {
      const el = appMgmt.nth(i);
      const tag = await el.evaluate(e => e.tagName);
      const text = await el.innerText().catch(() => '');
      const visible = await el.isVisible().catch(() => false);
      console.log(`  [${i}] tag=${tag} visible=${visible} "${text.trim().substring(0, 60)}"`);
      if (visible && text.includes('应用后台')) {
        await el.click({ force: true });
        console.log('✓ 已点击应用后台');
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);
        break;
      }
    }

    const backText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n应用后台页面:\n${backText.substring(0, 2000)}`);

    await page.screenshot({ path: 'screenshots/master-2-backend.png', fullPage: true });

    // ====== Step 3: Look for 新建表单 / 新建流程表单 ======
    console.log('\n====== Step 3: 查找新建表单 ======');

    // Search all buttons
    const allBtns = page.locator('button, [role="button"], [class*="create"]');
    const abCount = await allBtns.count();
    const visibleBtns: any[] = [];
    for (let i = 0; i < Math.min(abCount, 50); i++) {
      const btn = allBtns.nth(i);
      const text = await btn.innerText().catch(() => '');
      const cls = await btn.getAttribute('class').catch(() => '');
      const visible = await btn.isVisible().catch(() => false);
      if (visible && text.trim()) {
        visibleBtns.push({ idx: i, text: text.trim().substring(0, 80), class: cls?.substring(0, 80) });
      }
    }
    console.log(`可见按钮 (${visibleBtns.length}个):`);
    visibleBtns.forEach(b => console.log(`  [${b.idx}] "${b.text}"`));

    // Try clicking "新建" or "创建"
    const createBtn = page.locator('button:has-text("新建"), button:has-text("创建"), span:has-text("新建表单")').first();
    if (await createBtn.count() > 0 && await createBtn.isVisible().catch(() => false)) {
      await createBtn.click({ force: true });
      console.log('✓ 已点击新建');
      await page.waitForTimeout(2000);
      const postCreate = await page.locator('body').first().innerText().catch(() => '');
      console.log(`点击后:\n${postCreate.substring(0, 1000)}`);
    }

    await page.screenshot({ path: 'screenshots/master-3-create.png', fullPage: true });

    // ====== Step 4: Check URL for app management ======
    console.log('\n====== Step 4: URL和导航 ======');
    console.log(`当前URL: ${page.url()}`);

    // Try direct URL to app management
    const mgmtUrl = `https://www.jiandaoyun.com/app#/app/${APP_ID}/setting`;
    await page.goto(mgmtUrl, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const mgmtText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`应用设置页面:\n${mgmtText.substring(0, 1500)}`);

    await page.screenshot({ path: 'screenshots/master-4-mgmt.png', fullPage: true });

    // ====== Step 5: Try form management URL ======
    console.log('\n====== Step 5: 表单管理 ======');
    const formMgmtUrl = `https://www.jiandaoyun.com/app#/app/${APP_ID}/form`;
    await page.goto(formMgmtUrl, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const formText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`表单管理页面:\n${formText.substring(0, 1500)}`);

    await page.screenshot({ path: 'screenshots/master-5-form.png', fullPage: true });

    console.log('\n====== Phase 1 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
