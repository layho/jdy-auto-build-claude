/**
 * Phase 17 - 探索智能助手工作流编辑器
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
  console.log('[PHASE 17 - AUTOMATION EDITOR]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(SMART_EDIT_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(5000);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log('智能助手编辑器:');
    console.log(text.substring(0, 2500));

    await page.screenshot({ path: 'screenshots/master17-automation-editor.png', fullPage: true });

    // ====== Find the middle action node ======
    const canvasHTML = await page.evaluate(() => {
      const canvas = document.querySelector('[class*="workflow-canvas"], [class*="flow-canvas"], [class*="automation-canvas"], [class*="dag"], [class*="graph"]');
      if (canvas) return (canvas as HTMLElement).innerHTML?.substring(0, 5000);
      // Try the whole editor
      const editor = document.querySelector('[class*="automation-edit"], [class*="trigger-edit"]');
      return editor ? (editor as HTMLElement).innerHTML?.substring(0, 5000) : 'not found';
    });
    console.log('\n编辑器HTML:');
    console.log(canvasHTML?.substring(0, 4000));

    // ====== Try clicking the middle node "未设置" ======
    console.log('\n====== 尝试点击"未设置"节点 ======');
    const middleNode = page.locator(':has-text("未设置")').first();
    console.log(`  "未设置"元素: ${await middleNode.count()}个`);

    // Find and click the action node
    const actionNode = page.locator('[class*="node"]:has-text("未设置")').first();
    if (await actionNode.count() > 0) {
      await actionNode.click({ force: true });
      await page.waitForTimeout(3000);
      console.log('  已点击未设置节点');
    }

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log('\n点击后:');
    console.log(text.substring(0, 2500));

    // Check for action config panel/dialog
    const actionDialogs = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="dialog"], [class*="panel"], [class*="drawer"], [class*="config"]')]
        .filter(el => {
          const text = (el as HTMLElement).innerText?.trim();
          return text && text.length > 10;
        })
        .map(el => ({
          class: (el as HTMLElement).className?.substring(0, 120),
          text: (el as HTMLElement).innerText?.substring(0, 800),
        }));
    });

    console.log('\n动作配置面板:');
    actionDialogs.forEach((d: any) => {
      console.log(`\n[${d.class}]:`);
      console.log(d.text?.substring(0, 500));
    });

    await page.screenshot({ path: 'screenshots/master17-action-config.png', fullPage: true });

    // ====== Try adding an action ======
    console.log('\n====== 查找动作类型 ======');
    // Look for action buttons like 新增数据, 修改数据 etc.
    const allButtons = await page.evaluate(() => {
      return [...document.querySelectorAll('button, [role="button"]')]
        .filter(b => (b as HTMLElement).offsetParent !== null)
        .map(b => (b as HTMLElement).innerText?.trim()?.substring(0, 40))
        .filter(t => t && t.length > 0);
    });

    const uniqueButtons = [...new Set(allButtons)];
    console.log(`可见按钮 (${uniqueButtons.length}个):`);
    uniqueButtons.forEach(b => console.log(`  "${b}"`));

    // ====== Also explore dashboard ======
    console.log('\n\n====== 仪表盘探索 ======');
    // Try the app dashboard page
    const dashUrls = [
      'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/dashboard',
      'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/dashboard/list',
    ];
    for (const url of dashUrls) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(3000);
      text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`URL: ${url}`);
      console.log(text.substring(0, 500));
      console.log('---');
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
