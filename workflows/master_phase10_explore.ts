/**
 * Phase 10 - 探索智能助手、数据工厂、数据推送的创建流程
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const BASE = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#';

async function exploreSection(page: Page, hash: string, name: string, createBtnText: string) {
  console.log(`\n====== ${name} ======`);
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);

  let text = await page.locator('body').first().innerText().catch(() => '');
  console.log(`当前页面 (${name}):`);
  console.log(text.substring(0, 1200));

  // Try clicking create button
  const createBtn = page.locator(`button:has-text("${createBtnText}")`).first();
  if (await createBtn.count() > 0 && await createBtn.isVisible().catch(() => false)) {
    console.log(`\n✓ 找到"${createBtnText}"按钮，点击...`);
    await createBtn.click({ force: true });
    await page.waitForTimeout(4000);
    await waitForStableDOM(page);

    text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`点击后:\n${text.substring(0, 2000)}`);

    await page.screenshot({ path: `screenshots/master10-${name}-create.png`, fullPage: true });

    // Look for dialogs
    const dialogs = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="dialog"]')].map(d => ({
        class: (d as HTMLElement).className?.substring(0, 120),
        text: (d as HTMLElement).innerText?.substring(0, 800),
      }));
    });
    dialogs.forEach((d: any) => {
      console.log(`\n对话框 [${d.class}]:`);
      console.log(d.text);
    });
  } else {
    console.log(`未找到"${createBtnText}"按钮`);
  }

  await page.screenshot({ path: `screenshots/master10-${name}.png`, fullPage: true });
}

async function main() {
  console.log('[PHASE 10 - EXPLORE MODULES]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Explore Smart Assistant
    await exploreSection(page, 'app_trigger', '智能助手', '新建智能助手');

    // Explore Data Factory
    await exploreSection(page, 'app_etl', '数据工厂', '新建数据流');

    // Explore Data Push
    await exploreSection(page, 'app_data_push', '数据推送', '新建数据推送');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
