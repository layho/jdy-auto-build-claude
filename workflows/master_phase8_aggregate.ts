/**
 * Phase 8 - 创建聚合表
 * 使用订单管理+订单明细表数据创建销售额汇总聚合表
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const AGGREGATE_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_aggregate';

async function main() {
  console.log('[PHASE 8 - CREATE AGGREGATE TABLE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Step 1: Go to aggregate table page ======
    await page.goto(AGGREGATE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    console.log('当前聚合表页面:');
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log(text.substring(0, 800));

    // ====== Step 2: Click 新建聚合表 ======
    const createBtn = page.locator('button:has-text("新建聚合表"), span:has-text("新建聚合表")').first();
    if (await createBtn.count() > 0 && await createBtn.isVisible().catch(() => false)) {
      console.log('\n✓ 找到新建聚合表按钮，点击...');
      await createBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      text = await page.locator('body').first().innerText().catch(() => '');
      console.log('点击后页面:');
      console.log(text.substring(0, 2000));

      await page.screenshot({ path: 'screenshots/master8-aggregate-create.png', fullPage: true });

      // ====== Step 3: Analyze the creation dialog/form ======
      const dialogInfo = await page.evaluate(() => {
        // Look for dialogs, modals, or forms
        const dialogs = document.querySelectorAll('[class*="dialog"], [class*="modal"], [class*="drawer"], [class*="popup"]');
        const result: any[] = [];
        dialogs.forEach(d => {
          const rect = d.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) {
            result.push({
              class: (d as HTMLElement).className?.substring(0, 150),
              rect: `w:${rect.width.toFixed(0)},h:${rect.height.toFixed(0)}`,
              html: (d as HTMLElement).innerHTML?.substring(0, 3000),
              text: (d as HTMLElement).innerText?.substring(0, 500),
            });
          }
        });
        return result;
      });

      console.log('\n弹窗/对话框:');
      dialogInfo.forEach((d: any, i: number) => {
        console.log(`  [${i}] ${d.class} ${d.rect}`);
        console.log(`    文本: ${d.text?.substring(0, 300)}`);
      });

      // Also check the full page for any form
      const mainContent = await page.evaluate(() => {
        const main = document.querySelector('.main-content, [class*="content"], .app-setting, #app');
        if (!main) return document.body.innerText?.substring(0, 3000);
        return (main as HTMLElement).innerText?.substring(0, 3000);
      });
      console.log('\n主内容区文本:');
      console.log(mainContent);

    } else {
      console.log('未找到新建聚合表按钮');
      // Look for all buttons
      const buttons = await page.evaluate(() => {
        return [...document.querySelectorAll('button, [role="button"]')]
          .filter(b => {
            const text = (b as HTMLElement).innerText?.trim();
            return text && text.length > 1;
          })
          .map(b => ({
            text: (b as HTMLElement).innerText?.trim()?.substring(0, 60),
            class: (b as HTMLElement).className?.substring(0, 80),
            visible: (b as HTMLElement).offsetParent !== null,
          }));
      });
      console.log('可见按钮:');
      buttons.filter(b => b.visible).forEach(b => console.log(`  "${b.text}" class=${b.class}`));
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
