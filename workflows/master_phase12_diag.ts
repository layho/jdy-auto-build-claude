/**
 * Phase 12 - 精确诊断智能助手和数据推送的创建对话框
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const BASE = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#';

async function main() {
  console.log('[PHASE 12 - DIALOG DIAG]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 智能助手对话框 HTML ======
    console.log('====== 1. 智能助手对话框 HTML ======');
    await page.goto(`${BASE}/app_trigger`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建智能助手")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const smartDialogHTML = await page.evaluate(() => {
      const dlg = document.querySelector('.fx-automation-trigger-config-dialog');
      return dlg ? (dlg as HTMLElement).innerHTML?.substring(0, 6000) : 'not found';
    });
    console.log(smartDialogHTML?.substring(0, 5000));

    await page.screenshot({ path: 'screenshots/master12-smart-dialog.png', fullPage: true });

    // Close
    await page.locator('.fx-automation-trigger-config-dialog .dialog-footer button:has-text("取消")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);

    // ====== 2. 数据推送对话框 HTML ======
    console.log('\n\n====== 2. 数据推送对话框 HTML ======');
    await page.goto(`${BASE}/app_data_push`, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('button:has-text("新建数据推送")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const pushDialogHTML = await page.evaluate(() => {
      const dlg = document.querySelector('.fx-app-data-push-create-dialog');
      return dlg ? (dlg as HTMLElement).innerHTML?.substring(0, 5000) : 'not found';
    });
    console.log(pushDialogHTML?.substring(0, 4000));

    await page.screenshot({ path: 'screenshots/master12-push-dialog.png', fullPage: true });

    // ====== 3. Also check - are there dashboards we can explore? ======
    console.log('\n\n====== 3. 仪表盘 ======');
    const dashboardURL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06/dashboard';
    await page.goto(dashboardURL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const dashText = await page.locator('body').first().innerText().catch(() => '');
    console.log('仪表盘页面:');
    console.log(dashText.substring(0, 1500));

    await page.screenshot({ path: 'screenshots/master12-dashboard.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
