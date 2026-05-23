/**
 * Phase 7 - 检查现有表单字段和数据，为创建聚合表/数据工厂等做准备
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function analyzeForm(page: Page, formName: string) {
  console.log(`\n====== 表单: ${formName} ======`);

  // Navigate to form
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  // Click the form in the left nav
  const formNode = page.locator('.tree-node').filter({ hasText: formName }).first();
  if (await formNode.count() > 0) {
    await formNode.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);
  }

  // Make sure we're in manage all mode
  const text = await page.locator('body').first().innerText().catch(() => '');
  if (text.includes('仅添加数据')) {
    await page.locator('text=仅添加数据').first().click({ force: true });
    await page.waitForTimeout(800);
    const ma = page.locator('[class*="option"]:has-text("管理全部数据")').first();
    if (await ma.count() > 0) await ma.click({ force: true });
    await page.waitForTimeout(1500);
  }

  // Go to data management view
  const dataTab = page.locator('span:has-text("数据管理")').first();
  if (await dataTab.count() > 0) {
    await dataTab.click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
  }

  // Check data count
  const pageText = await page.locator('body').first().innerText().catch(() => '');

  // Count records
  const countMatch = pageText.match(/共\s*(\d+)\s*条/);
  const count = countMatch ? countMatch[1] : '未知';

  // Get table headers
  const headers = await page.evaluate(() => {
    const ths = document.querySelectorAll('th, [class*="header"], [class*="column-title"]');
    return [...ths].slice(0, 20).map(th => (th as HTMLElement).innerText?.trim()).filter(Boolean);
  });

  console.log(`  记录数: ${count}`);
  console.log(`  列头: ${headers.join(', ')}`);

  // Get first few data rows
  const rows = await page.evaluate(() => {
    const trs = document.querySelectorAll('tbody tr');
    return [...trs].slice(0, 3).map(tr => {
      const cells = tr.querySelectorAll('td');
      return [...cells].slice(0, 10).map(td => (td as HTMLElement).innerText?.trim()?.substring(0, 40));
    });
  });

  console.log('  数据示例:');
  rows.forEach((r, i) => {
    if (r.some(c => c)) console.log(`    [${i}] ${r.filter(c => c).join(' | ')}`);
  });

  return { count, headers, rows };
}

async function main() {
  console.log('[PHASE 7 - DATA AUDIT]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    const forms = ['客户信息', '产品信息', '订单管理', '订单明细表'];
    for (const form of forms) {
      await analyzeForm(page, form);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
