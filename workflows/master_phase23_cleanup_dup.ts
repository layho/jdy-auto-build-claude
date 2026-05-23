/**
 * Phase 23b - Quick cleanup: remove duplicate aggregate tables
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const AGGREGATE_LIST = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_aggregate';

async function main() {
  console.log('[PHASE 23B - CLEANUP DUPLICATE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // List current state
    const cards = await page.evaluate(() => {
      return [...document.querySelectorAll('li.fx-aggregate-view-card')].map((el, i) => ({
        i,
        title: el.querySelector('.head-title')?.textContent?.trim() || '',
        status: el.querySelector('.status-text')?.textContent?.trim() || '',
      }));
    });
    console.log('当前聚合表:');
    cards.forEach(c => console.log(`  [${c.i}] "${c.title}" → ${c.status}`));

    // Delete any with "请检查聚合表设置" (broken ones)
    const brokenCards = page.locator('li.fx-aggregate-view-card').filter({ hasText: '请检查聚合表设置' });
    const brokenCount = await brokenCards.count();
    console.log(`\n需要删除的异常聚合表: ${brokenCount}个`);

    for (let i = 0; i < brokenCount; i++) {
      const card = brokenCards.first(); // Always re-query first
      const title = await card.locator('.head-title').innerText().catch(() => `broken-${i}`);
      console.log(`\n删除 [${i + 1}/${brokenCount}]: "${title.trim()}"`);

      await card.scrollIntoViewIfNeeded();
      await card.hover({ force: true });
      await page.waitForTimeout(300);

      await card.locator('button.aggregate-delete-btn').first().click({ force: true });
      await page.waitForTimeout(800);

      const msg = page.locator('.fx-nav-message, .message').filter({ hasText: '删除' }).first();
      await msg.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await page.locator('button:has-text("删除")').last().click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
      console.log(`✓ 已删除`);
    }

    // Final state
    await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const finalCards = await page.evaluate(() => {
      return [...document.querySelectorAll('li.fx-aggregate-view-card')].map(el => ({
        title: el.querySelector('.head-title')?.textContent?.trim() || '',
        status: el.querySelector('.status-text')?.textContent?.trim() || '',
        dim: el.querySelector('.info-heads .info-text')?.textContent?.trim() || '--',
        metric: el.querySelector('.info-values .info-text')?.textContent?.trim() || '--',
      }));
    });
    console.log('\n最终:');
    finalCards.forEach(c => console.log(`  "${c.title}" 维度=${c.dim} 指标=${c.metric} "${c.status}"`));

    console.log('\n[DONE]');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
