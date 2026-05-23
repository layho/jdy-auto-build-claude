/**
 * Phase 22 - 清理13个未命名聚合表
 * Confirmation: .message / .fx-nav-message component with "删除" and "取消" buttons
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
  console.log('[PHASE 22 - CLEANUP JUNK AGG TABLES]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    let totalDeleted = 0;

    while (totalDeleted < 13) {
      // Navigate to list
      await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(2000);

      const junkCards = page.locator('li.fx-aggregate-view-card').filter({ hasText: '未命名聚合表' });
      const count = await junkCards.count();
      console.log(`\n剩余未命名聚合表: ${count}个`);

      if (count === 0) {
        console.log('全部删除完毕!');
        break;
      }

      // Scroll to first card, hover, click delete
      const card = junkCards.first();
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await card.hover({ force: true });
      await page.waitForTimeout(500);

      const deleteBtn = card.locator('button.aggregate-delete-btn').first();
      await deleteBtn.click({ force: true });
      console.log('✓ 点击删除按钮');
      await page.waitForTimeout(800);

      // Wait for confirmation message to appear
      const confirmMsg = page.locator('.fx-nav-message, .message, [class*="message"]').filter({ hasText: '删除' }).first();
      try {
        await confirmMsg.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✓ 确认弹窗出现');

        const msgText = await confirmMsg.innerText().catch(() => '');
        console.log(`  "${msgText?.substring(0, 200)}"`);

        // Click "删除" button in the confirmation
        const delConfirmBtn = page.locator('button:has-text("删除")').last();
        // Make sure it's the confirm button, not the card's delete button
        const confirmBtnVisible = await delConfirmBtn.isVisible().catch(() => false);
        console.log(`  确认删除按钮可见: ${confirmBtnVisible}`);

        if (confirmBtnVisible) {
          await delConfirmBtn.click({ force: true });
          console.log('✓ 点击确认删除');
          await page.waitForTimeout(2000);
          // Wait for success toast or list refresh
          await waitForStableDOM(page);
          await page.waitForTimeout(2000);
        }
      } catch {
        console.log('✗ 确认弹窗未出现');
        await page.screenshot({ path: `screenshots/master22-no-confirm-${totalDeleted}.png`, fullPage: true });
      }

      // Verify deletion
      await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(2000);

      const newCount = await page.locator('li.fx-aggregate-view-card').filter({ hasText: '未命名聚合表' }).count();
      if (newCount < count) {
        totalDeleted++;
        console.log(`✓ 已删除 (${totalDeleted}/13)`);
      } else {
        console.log(`⚠ 数量未变化: ${count} → ${newCount}`);
        // Check for the message again - maybe it's still showing
        const stillMsg = page.locator('.fx-nav-message, .message').filter({ hasText: '删除' }).first();
        if (await stillMsg.isVisible().catch(() => false)) {
          console.log('确认弹窗仍在，再次点击删除...');
          const delBtn2 = page.locator('button:has-text("删除")').last();
          await delBtn2.click({ force: true });
          await page.waitForTimeout(2000);
          await waitForStableDOM(page);

          // Re-check
          await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
          await waitForStableDOM(page);
          await page.waitForTimeout(2000);
          const nc2 = await page.locator('li.fx-aggregate-view-card').filter({ hasText: '未命名聚合表' }).count();
          if (nc2 < count) {
            totalDeleted++;
            console.log(`✓ 已删除 (${totalDeleted}/13)`);
          } else {
            console.log('✗ 仍无法删除，继续下一个');
            totalDeleted++; // Count anyway to avoid infinite loop
          }
        } else {
          totalDeleted++; // Avoid infinite loop
        }
      }
    }

    // Final
    const allCards = page.locator('li.fx-aggregate-view-card');
    const junk = page.locator('li.fx-aggregate-view-card').filter({ hasText: '未命名聚合表' });
    console.log(`\n最终: 总=${await allCards.count()}, 未命名=${await junk.count()}`);
    await page.screenshot({ path: 'screenshots/master22-final.png', fullPage: true });
    console.log('[DONE]');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
