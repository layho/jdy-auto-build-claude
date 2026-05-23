/**
 * 实践：创建流程表单 + 配置审批流程
 *
 * 学习点:
 * 1. 如何创建流程表单
 * 2. 流程节点配置（节点负责人、流转规则）
 * 3. 表单切换类型（普通↔流程）
 *
 * 操作流程:
 * 1. 进入应用后台 → 应用设置
 * 2. 新建流程表单
 * 3. 添加字段
 * 4. 配置流程节点
 * 5. 发布表单
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
  console.log('[PRACTICE WORKFLOW FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入应用设置/管理页面 ======
    console.log('====== 1. 应用管理 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 查找页面上可用的管理入口
    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`页面入口:\n${pageText.substring(0, 1000)}`);

    // 尝试进入应用后台
    // 通常入口在左上角菜单或顶部导航
    const menuBtns = page.locator('[class*="menu"], [class*="nav"], [class*="header"] button, [class*="header"] [class*="icon"]');
    const mbCount = await menuBtns.count();
    console.log(`\n菜单按钮: ${mbCount}个:`);
    for (let i = 0; i < Math.min(mbCount, 15); i++) {
      const btn = menuBtns.nth(i);
      const text = await btn.innerText().catch(() => '');
      const cls = await btn.getAttribute('class').catch(() => '');
      if (text.trim()) console.log(`  [${i}] "${text.trim()}" class=${cls?.substring(0, 60)}`);
    }

    // 查找新建表单入口
    await page.screenshot({ path: 'screenshots/practice-wf-1-dashboard.png', fullPage: true });

    // ====== 2. 尝试找到新建流程表单入口 ======
    console.log('\n====== 2. 新建流程表单 ======');

    // 常见入口: 顶部 + 新建按钮, 或应用设置中的新建
    const createBtns = page.locator('button:has-text("新建"), span:has-text("新建"), [class*="create"]');
    const cbCount = await createBtns.count();
    console.log(`"新建" 按钮: ${cbCount}个`);

    for (let i = 0; i < cbCount; i++) {
      const btn = createBtns.nth(i);
      const text = await btn.innerText().catch(() => '');
      const tag = await btn.evaluate(e => e.tagName);
      const visible = await btn.isVisible().catch(() => false);
      console.log(`  [${i}] tag=${tag} visible=${visible} "${text.trim()}"`);
      if (visible && text.includes('新建')) {
        await btn.click({ force: true });
        await page.waitForTimeout(1500);
        const postClick = await page.locator('body').first().innerText().catch(() => '');
        console.log(`  点击后:\n${postClick.substring(0, 500)}`);
        break;
      }
    }

    await page.screenshot({ path: 'screenshots/practice-wf-2-create-menu.png', fullPage: true });

    // ====== 3. 探索是否存在流程表单创建选项 ======
    console.log('\n====== 3. 探索创建选项 ======');
    const panelText = await page.locator('body').first().innerText().catch(() => '');
    console.log(panelText.substring(0, 2000));

    // ====== 4. 如果已有流程表单创建的选项，选择"流程表单" ======
    const wfOption = page.locator(':has-text("流程表单")').first();
    if (await wfOption.count() > 0) {
      console.log('\n✓ 找到流程表单选项');
      await wfOption.click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/practice-wf-3-editor.png', fullPage: true });
    } else {
      console.log('\n未找到流程表单选项，尝试检查表单类型切换');
      // 在已有表单的编辑器中，可能可以切换表单类型
    }

    console.log('\n====== 流程表单探索完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
