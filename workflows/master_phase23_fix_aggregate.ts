/**
 * Phase 23 - Fix aggregate table with correct formula insertion
 * Strategy: clear CodeMirror first → then dblclick tree item once
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const AGGREGATE_LIST = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_aggregate';

async function deleteCard(page: Page, name: string) {
  const card = page.locator('li.fx-aggregate-view-card').filter({ hasText: name }).first();
  if (await card.count() === 0) return;
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
}

async function main() {
  console.log('[PHASE 23 - FIX AGGREGATE TABLE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. Clean slate ======
    await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Delete existing "订单销量统计"
    const existing = page.locator('li.fx-aggregate-view-card').filter({ hasText: '订单' }).first();
    if (await existing.count() > 0) {
      const title = await existing.locator('.head-title').innerText().catch(() => '');
      await deleteCard(page, title);
      console.log(`✓ 删除: ${title}`);
    }

    await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // ====== 2. Create new ======
    await page.locator('button:has-text("新建聚合表")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    await page.locator('button:has-text("添加来源表")').first().click({ force: true });
    await page.waitForTimeout(800);
    await page.locator('[class*="popover"] .entry-item:has-text("订单管理")').first().click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('button:has-text("确定")').last().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    await page.locator('button:has-text("添加维度")').first().click({ force: true });
    await page.waitForTimeout(1000);
    const dimOpt = page.locator('[class*="select-dropdown"] [class*="option"]:has-text("下单日期")').first();
    if (await dimOpt.isVisible().catch(() => false)) {
      await dimOpt.click({ force: true });
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ====== 3. Add metric ======
    await page.locator('button:has-text("添加指标")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // Fill name
    const nameInput = page.locator('.aggregate-formula-edit-dialog-content input.input-inner').first();
    await nameInput.click({ force: true });
    await nameInput.fill('订单数量');
    await page.waitForTimeout(300);

    // Focus CodeMirror and clear completely
    const cmTextarea = page.locator('.CodeMirror textarea').first();
    await cmTextarea.click({ force: true });
    await page.waitForTimeout(300);

    // Select all and delete
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(100);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Verify clean
    let cmContent = await page.evaluate(() => {
      const lines = document.querySelectorAll('.CodeMirror-line');
      return [...lines].map(l => l.textContent?.trim()).filter(t => t && t !== '​').join('');
    });
    console.log(`清空后公式: "${cmContent}"`);

    // Double-click tree item to insert variable
    await page.locator('.tree-item.data-count').first().dblclick({ force: true });
    await page.waitForTimeout(500);

    // Check content after insertion
    cmContent = await page.evaluate(() => {
      const lines = document.querySelectorAll('.CodeMirror-line');
      return [...lines].map(l => l.textContent?.trim()).filter(t => t && t !== '​').join(' ');
    });
    console.log(`插入后公式: "${cmContent}"`);

    // If still shows duplicate COUNT, try clearing and single click
    const countMatches = (cmContent?.match(/COUNT/g) || []).length;
    console.log(`COUNT出现次数: ${countMatches}`);

    if (countMatches > 1) {
      // Clear and try single-click approach
      console.log('仍有重复，清理后用单击...');
      await cmTextarea.click({ force: true });
      await page.waitForTimeout(100);
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(100);

      // Try clicking the tree-node instead of tree-item
      await page.locator('.tree-node').filter({ hasText: '数据条数' }).first().click({ force: true });
      await page.waitForTimeout(500);

      cmContent = await page.evaluate(() => {
        const lines = document.querySelectorAll('.CodeMirror-line');
        return [...lines].map(l => l.textContent?.trim()).filter(t => t && t !== '​').join(' ');
      });
      console.log(`单击后公式: "${cmContent}"`);
    }

    // Check also the aggregation "备注" field for editor name
    await page.screenshot({ path: 'screenshots/master23-formula-state.png', fullPage: true });

    // Check the "备注" area for the formula display
    const formulaDisplay = await page.evaluate(() => {
      const cm = document.querySelector('.CodeMirror-code');
      if (!cm) return '';
      const allLines = cm.querySelectorAll('.CodeMirror-line');
      return [...allLines].map(l => {
        // Get all spans inside the line
        const spans = l.querySelectorAll('span[role="presentation"] span');
        return [...spans].map(s => (s as HTMLElement).innerText || s.textContent).join('');
      }).join(' | ');
    });
    console.log(`详细公式内容: "${formulaDisplay}"`);

    // Now confirm the formula dialog
    const okBtn = page.locator('.dialog-footer button:has-text("确定"), [class*="formula"] button:has-text("确定")').last();
    await okBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await waitForStableDOM(page);
    console.log('✓ 确认公式');

    // Check if dialog closed and metric appears
    let bodyText = await page.locator('body').first().innerText().catch(() => '');
    const hasMetricName = bodyText.includes('订单数量');
    const stillHasDialog = bodyText.includes('指标设置') && bodyText.includes('取消');
    console.log(`指标已添加: ${hasMetricName}, 对话框仍开: ${stillHasDialog}`);

    // If dialog still open, close it
    if (stillHasDialog) {
      await page.locator('.dialog-footer button:has-text("取消")').first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // ====== 4. Save ======
    await page.screenshot({ path: 'screenshots/master23-before-save.png', fullPage: true });

    // Rename
    const titleInput = page.locator('.fx-title-editor input').first();
    if (await titleInput.count() > 0) {
      await titleInput.click({ clickCount: 3, force: true });
      await titleInput.fill('订单销量统计');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    const saveBtn = page.locator('button:has-text("保存")').last();
    await saveBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n保存后 (前500):\n${bodyText.substring(0, 500)}`);

    await page.screenshot({ path: 'screenshots/master23-final.png', fullPage: true });

    // ====== Verify ======
    await page.goto(AGGREGATE_LIST, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const cards = await page.evaluate(() => {
      return [...document.querySelectorAll('li.fx-aggregate-view-card')].map(el => ({
        title: el.querySelector('.head-title')?.textContent?.trim() || '',
        status: el.querySelector('.status-text')?.textContent?.trim() || '',
        dim: el.querySelector('.info-heads .info-text')?.textContent?.trim() || '--',
        metric: el.querySelector('.info-values .info-text')?.textContent?.trim() || '--',
      }));
    });
    console.log('\n最终聚合表:');
    cards.forEach(c => console.log(`  "${c.title}" 维度=${c.dim} 指标=${c.metric} "${c.status}"`));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
