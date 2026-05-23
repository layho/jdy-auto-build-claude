/**
 * Phase 4 - 通过URL hash导航到不同设置页
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const SETTINGS_BASE = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#';

async function tryURL(page: Page, hash: string, label: string) {
  const url = `${SETTINGS_BASE}/${hash}`;
  console.log(`\n====== ${label} ======`);
  console.log(`URL: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  const text = await page.locator('body').first().innerText().catch(() => '');
  // Check if page content actually changed (not same as /app_group)
  console.log(text.substring(0, 600));
  return text;
}

async function main() {
  console.log('[PHASE 4 - URL HASH NAV]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Try all possible hash fragments
    const hashFragments = [
      // App management hashes
      'app_group', 'app_setting', 'app_settings', 'setting',
      'cross_app', 'cross',
      'aggregate', 'agg', 'aggregate_table',
      'smart_assistant', 'assistant', 'smart',
      'data_factory', 'factory', 'dataflow',
      'data_push', 'push', 'webhook',
      'flow_analysis', 'flow',
      'form', 'dashboard',
    ];

    const results: Record<string, string> = {};
    for (const hash of hashFragments) {
      const url = `${SETTINGS_BASE}/${hash}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(1000);

      const text = await page.locator('body').first().innerText().catch(() => '');
      const firstLine = text.split('\n').slice(0, 30).join('\n');
      const hasChanged = !text.includes('管理全部数据') && !text.includes('表单/仪表盘权限');
      results[hash] = hasChanged ? `✓ ${text.substring(0, 200)}` : '✗ (回到权限页)';
    }

    console.log('\n====== 结果汇总 ======');
    for (const [hash, result] of Object.entries(results)) {
      console.log(`  #/${hash}: ${result.substring(0, 100)}`);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
