/**
 * 全面探索当前应用的功能 - 了解已配置的数据联动、公式、权限等
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
  console.log('[EXPLORE APP FEATURES]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Dashboard overview ======
    console.log('====== 1. 应用后台概览 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Navigate to app backend/management
    const appBackBtn = page.locator('[class*="app-back"], .app-backend, button:has-text("应用后台")').first();
    if (await appBackBtn.count() > 0) {
      await appBackBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const backText = await page.locator('body').first().innerText().catch(() => '');
      console.log(`应用后台:\n${backText.substring(0, 2000)}`);
      await page.screenshot({ path: 'screenshots/explore-1-backend.png', fullPage: true });
    }

    // ====== 2. Check form list and their settings ======
    console.log('\n====== 2. 表单列表 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const treeNodes = page.locator('.tree-node');
    const tnCount = await treeNodes.count();
    console.log(`左侧导航节点: ${tnCount}个`);

    for (let i = 0; i < tnCount; i++) {
      const node = treeNodes.nth(i);
      const text = await node.innerText().catch(() => '');
      const cls = await node.getAttribute('class').catch(() => '');
      console.log(`  [${i}] "${text.trim()}" class=${cls?.substring(0, 60)}`);
    }

    // ====== 3. Check each form's entry page for configured features ======
    console.log('\n====== 3. 检查各表单功能 ======');
    for (const formName of ['客户信息', '产品信息', '订单管理', '订单明细表']) {
      console.log(`\n--- ${formName} ---`);
      await page.locator('.tree-node').filter({ hasText: formName }).first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const text = await page.locator('body').first().innerText().catch(() => '');
      const hasAdd = text.includes('添加');
      const hasExport = text.includes('导出');
      const hasImport = text.includes('导入');
      const hasDelete = text.includes('删除');
      const hasFilter = text.includes('筛选');
      const hasBatch = text.includes('批量操作');
      const hasView = text.includes('视图');
      const hasDashboard = text.includes('仪表盘');

      console.log(`  添加:${hasAdd} 导出:${hasExport} 导入:${hasImport} 删除:${hasDelete} 筛选:${hasFilter}`);
      console.log(`  批量:${hasBatch} 视图:${hasView} 仪表盘:${hasDashboard}`);

      // Check if it's a workflow form
      const isWorkflow = text.includes('流程') || text.includes('待办') || text.includes('审批');
      console.log(`  流程表单: ${isWorkflow}`);

      await page.screenshot({ path: `screenshots/explore-${formName}.png`, fullPage: true });
    }

    // ====== 4. Check for dashboards ======
    console.log('\n====== 4. 检查仪表盘 ======');
    const dashboardNodes = page.locator('.tree-node').filter({ hasText: /仪表盘|看板|统计/ });
    const dnCount = await dashboardNodes.count();
    console.log(`仪表盘节点: ${dnCount}个`);
    for (let i = 0; i < dnCount; i++) {
      const text = await dashboardNodes.nth(i).innerText().catch(() => '');
      console.log(`  "${text.trim()}"`);
    }

    // ====== 5. Check available features in 应用后台 ======
    console.log('\n====== 5. 应用后台功能 ======');
    await page.goto('https://www.jiandaoyun.com/app#/app/6a0aa9d82c4789aa80588d06/setting', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const settingText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`设置页面:\n${settingText.substring(0, 2000)}`);

    // Features to look for
    const features = ['数据工厂', '聚合表', '智能助手', '数据推送', '跨应用', '打印模板', '前端事件', '插件', 'API'];
    features.forEach(f => {
      const has = settingText.includes(f);
      if (has) console.log(`  ✓ ${f} - 可用`);
    });

    await page.screenshot({ path: 'screenshots/explore-5-settings.png', fullPage: true });

    console.log('\n====== 探索完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
