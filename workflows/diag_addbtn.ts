/**
 * 诊断：点击侧边栏 add-button 后会发生什么
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[DIAG] 测试 add-button 点击...\n');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 点击 add-button
    console.log('[DIAG] 点击 .add-button...');
    const addBtn = page.locator('.add-button').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // 读取页面内容
    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 点击后页面内容:\n${text.substring(0, 800)}\n`);
    console.log(`[DIAG] URL: ${page.url()}`);

    // 检查是否有弹窗/菜单
    const dialogText = await page.locator('[class*="dialog"], [class*="popup"], [class*="menu"], [class*="dropdown"], [class*="tooltip"]').first().innerText().catch(() => '');
    console.log(`[DIAG] 弹窗/菜单内容: "${dialogText?.substring(0, 500)}"`);

    await page.screenshot({ path: 'screenshots/diag-addbtn-click.png', fullPage: true });
    console.log('[DIAG] 截图已保存');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
