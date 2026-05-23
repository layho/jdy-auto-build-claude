/**
 * 检查当前状态：页面、字段、关联表是否创建成功
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[CHECK] 检查当前状态\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { browser, context, page } = s;
    await login(page);

    // 1. 列出所有打开的页面
    const allPages = context.pages();
    console.log(`====== 打开的页面: ${allPages.length} ======`);
    for (let i = 0; i < allPages.length; i++) {
      console.log(`  [${i}] ${allPages[i].url()}`);
    }

    // 2. 到应用首页看表单列表
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n====== 表单列表: ${formNames.join(', ')} ======`);

    // 3. 进入订单管理编辑器看字段
    const formEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await formEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await formEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n====== 订单管理表单内容 ======`);
    // 只显示字段相关的部分
    const fieldStart = text.indexOf('字段回收站');
    const fieldEnd = text.indexOf('字段属性');
    if (fieldStart >= 0 && fieldEnd > fieldStart) {
      console.log(text.substring(fieldStart, fieldEnd));
    }

    await page.screenshot({ path: 'screenshots/current-state.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
