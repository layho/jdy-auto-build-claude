/**
 * 发布表单 - 去"表单发布"标签页发布表单
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[PUBLISH FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入编辑器 ======
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== 先保存 ======
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      console.log('✓ 已保存');
      await page.waitForTimeout(2000);
    }

    // ====== 点击"表单发布"标签 ======
    console.log('寻找表单发布入口...');

    // 方法1: 顶部tab
    const publishTab = page.locator('[class*="tab"]:has-text("表单发布"), [class*="nav"]:has-text("表单发布"), div:has-text("表单发布")').first();
    if (await publishTab.count() > 0 && await publishTab.isVisible().catch(() => false)) {
      console.log('找到表单发布tab，点击...');
      await publishTab.click({ force: true });
      await page.waitForTimeout(3000);
    }

    // 检查页面内容
    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n当前页面:\n${text.substring(0, 2000)}`);

    // 查找"发布"按钮
    const publishBtnSelectors = [
      'button:has-text("发布")',
      'button:has-text("立即发布")',
      'button:has-text("确认发布")',
      '[class*="publish"] button',
    ];

    for (const sel of publishBtnSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        const btnText = await btn.innerText().catch(() => '');
        console.log(`\n找到按钮: "${btnText}", 点击...`);
        await btn.click({ force: true });
        await page.waitForTimeout(3000);
        console.log('✓ 已点击发布');
        break;
      }
    }

    // 可能发布后会有确认弹窗
    const confirmBtn = page.locator('button:has-text("确定"), button:has-text("确认")').first();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('✓ 已确认');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/publish-form.png', fullPage: true });

    // 检查是否发布成功
    const finalText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n发布结果: ${finalText.includes('发布成功') || finalText.includes('已发布') ? '✓ 成功' : '?'}`);

    // ====== 验证：去录入页看子表是否显示 ======
    console.log('\n====== 验证：录入页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let entryText = await page.locator('body').first().innerText().catch(() => '');

    // Switch view if needed
    if (entryText.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 点添加打开表单
    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    entryText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`录入页子表: ${entryText.includes('订单明细') ? '✓ 已显示' : '✗ 仍不显示'}`);

    if (entryText.includes('订单明细')) {
      // Find the relevant part
      const idx = entryText.indexOf('订单明细');
      console.log(`子表附近:\n${entryText.substring(Math.max(0, idx - 200), idx + 500)}`);
    }

    await page.screenshot({ path: 'screenshots/publish-verify.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
