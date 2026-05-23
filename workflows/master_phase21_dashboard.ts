/**
 * Phase 21 - 查找仪表盘创建入口，更新学习记忆
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
  console.log('[PHASE 21 - DASHBOARD & FINAL]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Look for dashboard creation in the app ======
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Enter manage all mode
    let text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(800);
      const ma = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await ma.count() > 0) await ma.click({ force: true });
      await page.waitForTimeout(1500);
    }

    // Look for the app top navigation or any create buttons
    // Get the full app layout
    const appLayout = await page.evaluate(() => {
      const results: any = {};

      // Check for any "新建" in the whole page
      const allElements = document.querySelectorAll('*');
      const createElements: any[] = [];
      for (const el of allElements) {
        const text = (el as HTMLElement).innerText?.trim();
        if (text && (text.includes('新建仪表盘') || text.includes('创建仪表盘') || text.includes('添加仪表盘'))) {
          createElements.push({
            tag: el.tagName,
            text,
            class: (el as HTMLElement).className?.substring(0, 100),
          });
        }
      }
      results.createElements = createElements;

      // Look at the left sidebar header
      const leftPane = document.querySelector('.left-pane, .app-view-menu, [class*="left-pane"]');
      if (leftPane) {
        results.leftPaneHTML = (leftPane as HTMLElement).innerHTML?.substring(0, 5000);
      }

      // Get the app header
      const appHeader = document.querySelector('[class*="app-view-header"], [class*="app-header"]');
      if (appHeader) {
        results.appHeaderHTML = (appHeader as HTMLElement).innerHTML?.substring(0, 2000);
      }

      return results;
    });

    console.log('创建仪表盘元素:');
    appLayout.createElements?.forEach((e: any) => console.log(`  ${e.tag} "${e.text}"`));

    if (!appLayout.createElements || appLayout.createElements.length === 0) {
      console.log('  未找到仪表盘创建入口');

      // Check the left pane for any add button
      console.log('\n左侧面板HTML (前3000字符):');
      console.log(appLayout.leftPaneHTML?.substring(0, 3000));
    }

    await page.screenshot({ path: 'screenshots/master21-app-layout.png', fullPage: true });

    // ====== 2. Try the personal chart creation ======
    console.log('\n\n====== 工作台 - 我的图表 ======');
    await page.goto('https://www.jiandaoyun.com/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click "添加" in 我的图表
    const addChartBtn = page.locator(':has-text("我的图表") + [class*="add"], :has-text("我的图表") ~ :has-text("添加")').first();
    console.log(`添加图表按钮: ${await addChartBtn.count()}个`);

    // Try a broader search
    const allAddLinks = page.locator(':has-text("添加")');
    const addCount = await allAddLinks.count();
    console.log(`"添加"链接: ${addCount}个`);

    for (let i = 0; i < Math.min(addCount, 5); i++) {
      const link = allAddLinks.nth(i);
      const t = await link.innerText().catch(() => '');
      const visible = await link.isVisible().catch(() => false);
      console.log(`  [${i}] "${t.trim()}" visible=${visible}`);
    }

    // ====== 3. Summary of what we've learned and created today ======
    console.log('\n\n====== 今日学习总结 ======');
    console.log('1. 设置页导航: 通过点击 li.x-navigation-item 导航到各设置页');
    console.log('   URL hash: app_group, app_ref, app_summary, app_aggregate, app_aggregation, app_trigger, app_etl, app_data_push, app_bpa');
    console.log('2. 聚合表: 创建流程 - 选择数据源 → 选择子表单 → 配置维度(多类型) → 配置指标(公式编辑器) → 保存');
    console.log('   已创建: 订单统计 (数据源:订单管理, 维度:下单日期, 指标:COUNT)');
    console.log('3. 数据推送: 创建流程 - 选择推送表单 → 配置服务器地址 → 配置推送事件 → 保存');
    console.log('   已创建: 推送订单管理到 https://httpbin.org/post (4个数据事件)');
    console.log('4. 智能助手: 创建流程 - 命名 → 选择触发方式(表单触发/定时触发/HTTP/按钮) → 选择触发表单');
    console.log('   已创建: 自动同步订单数据 (触发:订单管理, 待配置动作)');
    console.log('   工作流编辑器URL: dashboard/app/{app_id}/automation/{id}/edit');
    console.log('   动作类型: 新增数据, 修改数据, 删除数据, 计算节点, 更多节点');
    console.log('5. 数据工厂: 可视化DAG编辑器, 7个处理节点(横向连接/追加合并/分组汇总/数据筛选/字段设置/行转列/去重)');
    console.log('6. 仪表盘: 应用内无直接创建入口, 需进一步探索');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
