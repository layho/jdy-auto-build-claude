/**
 * stage0_clean_app.ts — 清空应用（删除所有表单/聚合表/智能助手）
 *
 * 修复：
 * 1. 原来通过 span.node-content-wrapper 点击表单再进编辑器删除，路径太长且容易失败
 *    → 简道云支持在左侧树节点上右键/hover 出现"删除"，直接在 app 视图操作
 * 2. 原来循环删除聚合表时每次都重新 locate .fx-aggregate-view-card，但删除后
 *    列表 rerender，导致 stale locator。改为每次重新 count 后只操作 first()
 * 3. 确认弹窗应使用 .fx-nav-message 而不是 button:has-text('确定')（可能误触其他按钮）
 * 4. 删除表单：需要右键 / hover 触发 context menu，然后点删除
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_ID = process.env.JDY_APP_ID ?? '6a0aa9d82c4789aa80588d06';
const APP_URL = `https://www.jiandaoyun.com/dashboard/app/${APP_ID}`;

// ─── 确认弹窗 ───────────────────────────────────────────────
async function confirmDialog(page: any): Promise<void> {
  // 简道云的确认弹窗是 .fx-nav-message，不是标准 dialog
  const selectors = [
    '.fx-nav-message button:has-text("确定")',
    '.message button:has-text("确定")',
    '[class*="confirm-dialog"] button:has-text("确定")',
    '[role="alertdialog"] button:has-text("确定")',
    // 最后兜底
    'button:has-text("删除")',
  ];
  await page.waitForTimeout(500);
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(1500);
      await waitForStableDOM(page, 500);
      return;
    }
  }
  console.warn('  [WARN] 未找到确认弹窗');
}

// ─── 删除聚合表 ──────────────────────────────────────────────
async function deleteAggregateTables(page: any): Promise<void> {
  console.log('\n[CLEAN] 删除聚合表...');
  await page.goto(`${APP_URL}/settings#/app_aggregate`, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  let rounds = 0;
  while (rounds < 20) {
    const cards = page.locator('.fx-aggregate-view-card');
    if (await cards.count() === 0) break;

    const card = cards.first();
    await card.hover();
    await page.waitForTimeout(500);

    const deleteBtn = card.locator('button[class*="delete"], [aria-label*="删除"], button:has-text("删除")').first();
    if (await deleteBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await deleteBtn.click({ force: true });
      await confirmDialog(page);
    } else {
      // hover 没出现删除，尝试右键
      await card.click({ button: 'right', force: true });
      await page.waitForTimeout(400);
      const menuDel = page.locator('[class*="dropdown"] :text-is("删除"), [class*="menu"] :text-is("删除")').first();
      if (await menuDel.isVisible({ timeout: 500 }).catch(() => false)) {
        await menuDel.click({ force: true });
        await confirmDialog(page);
      } else {
        console.log('  无法删除聚合表，跳过');
        break;
      }
    }
    rounds++;
  }
  console.log('  聚合表清理完成');
}

// ─── 删除智能助手 ─────────────────────────────────────────────
async function deleteSmartAssistants(page: any): Promise<void> {
  console.log('\n[CLEAN] 删除智能助手...');
  await page.goto(`${APP_URL}/settings#/app_trigger`, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  let rounds = 0;
  while (rounds < 20) {
    // 找所有自动化卡片
    const cards = page.locator('[class*="automation-card"], [class*="trigger-card"], [class*="card"]').filter({
      has: page.locator('button, [class*="action"]'),
    });
    if (await cards.count() === 0) break;

    let deleted = false;
    const cnt = await cards.count();
    for (let i = 0; i < cnt; i++) {
      const card = cards.nth(i);
      await card.hover();
      await page.waitForTimeout(400);

      const moreBtn = card.locator('[class*="more"], [class*="action-btn"], [aria-label*="更多"]').first();
      if (await moreBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await moreBtn.click({ force: true });
        await page.waitForTimeout(400);
        const delOpt = page.locator('[class*="dropdown"] :text-is("删除"), [class*="popover"] :text-is("删除")').first();
        if (await delOpt.isVisible({ timeout: 500 }).catch(() => false)) {
          await delOpt.click({ force: true });
          await confirmDialog(page);
          deleted = true;
          break;
        }
      }
    }
    if (!deleted) break;
    rounds++;
  }
  console.log('  智能助手清理完成');
}

// ─── 删除表单（在 app 视图中右键/hover 操作）──────────────────
async function deleteForms(page: any): Promise<void> {
  console.log('\n[CLEAN] 删除表单...');
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);

  let rounds = 0;
  while (rounds < 30) {
    // 左侧树节点（表单/仪表盘/报表）
    const treeNodes = page.locator('.tree-node, .fx-entry-node, span.node-content-wrapper');
    if (await treeNodes.count() === 0) break;

    const node = treeNodes.first();
    const nodeText = await node.textContent().catch(() => '');

    // 右键弹出 context menu
    await node.click({ button: 'right', force: true });
    await page.waitForTimeout(500);

    // context menu 里找"删除"
    const delItem = page.locator('[class*="context-menu"] :text-is("删除"), [class*="dropdown"] :text-is("删除"), li:text-is("删除")').first();
    if (await delItem.isVisible({ timeout: 800 }).catch(() => false)) {
      await delItem.click({ force: true });
      await confirmDialog(page);
      console.log(`  已删除: ${nodeText.trim()}`);
      // 等待列表刷新
      await page.waitForTimeout(1000);
      await waitForStableDOM(page, 300);
    } else {
      // 关闭可能出现的 context menu，然后跳出循环
      await page.keyboard.press('Escape');
      break;
    }
    rounds++;
  }
  console.log('  表单清理完成');
}

async function main() {
  console.log('[STAGE 0] 清空应用\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await deleteAggregateTables(page);
    await deleteSmartAssistants(page);
    await deleteForms(page);

    // 最终截图
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/stage0-cleaned.png', fullPage: true });

    const finalText = await page.locator('body').innerText().catch(() => '');
    console.log('\n[验证] 清理后状态:');
    console.log(finalText.substring(0, 400));
    console.log('\n[STAGE 0] 完成');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
