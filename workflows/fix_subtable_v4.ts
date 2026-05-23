/**
 * 修复关联子表 V4：直接通过属性面板的关联表下拉选订单明细表
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function readPage(page: Page): Promise<string> {
  return await page.locator('body').first().innerText().catch(() => '') || '';
}

async function main() {
  console.log('[FIX SUBTABLE V4]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入编辑器
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

    let text = await readPage(page);
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    // 如果没有订单明细字段，添加
    if (!fields.includes('订单明细')) {
      console.log('\n添加关联子表...');
      await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
      await page.waitForTimeout(1500);

      // 设标题
      const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
      await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
      await titleInput.fill('订单明细');
      await page.waitForTimeout(400);
    }

    // 查看是否有 dialog
    text = await readPage(page);
    if (text.includes('添加关联子表') && text.includes('从空白新建')) {
      console.log('有选择dialog，点取消先关掉...');
      await page.locator('button:has-text("取消")').last().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 点击订单明细字段打开属性面板
    const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await subField.count() > 0) {
      await subField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      console.log(`\n属性面板:\n${text.substring(text.indexOf('标题'), Math.min(text.indexOf('标题') + 1000, text.length))}`);

      // 找"关联表"下拉
      const allDDs = page.locator('.x-biz-dropdown-label');
      const ddCount = await allDDs.count();
      console.log(`\ndropdown数量: ${ddCount}`);

      for (let i = 0; i < ddCount; i++) {
        const dd = allDDs.nth(i);
        const ddVisible = await dd.isVisible().catch(() => false);
        const ddText = await dd.innerText().catch(() => '');
        if (ddVisible) {
          console.log(`  [${i}] "${ddText.substring(0, 50)}"`);
        }
      }

      // 点第一个可见的dropdown（应该是关联表）
      for (let i = 0; i < ddCount; i++) {
        const dd = allDDs.nth(i);
        const ddVisible = await dd.isVisible().catch(() => false);
        if (ddVisible) {
          console.log(`\n点击dropdown[${i}]...`);
          await dd.click({ force: true });
          await page.waitForTimeout(1500);

          text = await readPage(page);

          // 检查是否出现了"订单明细表"选项
          if (text.includes('订单明细表')) {
            console.log('找到订单明细表选项！');
            const opt = page.locator('[class*="option"]:has-text("订单明细表")').first();
            if (await opt.count() > 0 && await opt.isVisible().catch(() => false)) {
              await opt.click({ force: true });
              console.log('✓ 已选择订单明细表');
              await page.waitForTimeout(500);
              break;
            }
          } else {
            console.log(`dropdown[${i}]打开后没有订单明细表选项`);
            console.log(`内容:\n${text.substring(0, 1000)}`);
            // 关掉
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('\n✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== 验证 ======
    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`最终字段: ${fields.join(' | ')}`);

    // 重新点击订单明细验证关联表
    const finalSub = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await finalSub.count() > 0) {
      await finalSub.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);
      console.log(`\n关联表验证: ${text.includes('订单明细表') && !text.includes('已删除') ? '✓ 正确绑定' : '⚠ 可能未绑定'}`);
    }

    // ====== 提交测试订单 ======
    console.log('\n====== 测试提交 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`录入页字段: ${text.includes('订单明细') ? '含子表' : '无子表'}`);
    console.log(text.substring(0, 500));

    await page.screenshot({ path: 'screenshots/subtable-final-v4.png', fullPage: true });
    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
