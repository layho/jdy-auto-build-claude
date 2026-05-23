/**
 * 清理重复字段 V3：确认弹窗按钮是"删除"不是"确定"
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
  console.log('[CLEAN DUPLICATE V3]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

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

    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    // 找到"订单明细"字段中损坏的那个（先出现的应该是损坏的）
    const orderDetailIndices: number[] = [];
    fields.forEach((f, i) => {
      if (f === '订单明细') orderDetailIndices.push(i);
    });
    console.log(`订单明细位置: ${orderDetailIndices}`);

    if (orderDetailIndices.length > 1) {
      // 先点击第一个
      const fieldIdx = orderDetailIndices[0];
      console.log(`选择字段 [${fieldIdx}]...`);
      const fieldEl = page.locator('.fx-field-layout.field').nth(fieldIdx);
      await fieldEl.click({ force: true });
      await page.waitForTimeout(800);

      let text = await readPage(page);
      console.log(`关联状态: ${text.includes('已删除') || text.includes('关联不存在') ? '损坏' : '正常'}`);
      console.log(`关联信息: ${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 100)}`);

      // 找到可见的删除图标
      const allDeleteIcons = page.locator('i.btn-delete.btn-trash');
      const iconCount = await allDeleteIcons.count();
      console.log(`删除图标: ${iconCount}个`);

      let deleted = false;
      for (let i = 0; i < iconCount; i++) {
        const icon = allDeleteIcons.nth(i);
        const vis = await icon.isVisible().catch(() => false);
        if (vis) {
          console.log(`点击可见删除图标 [${i}]...`);
          await icon.click({ force: true });
          await page.waitForTimeout(1500);

          // 检查确认弹窗
          text = await readPage(page);
          console.log(`弹窗文本: "${text.substring(text.indexOf('确定删除'), text.indexOf('确定删除') + 150)}"`);

          // 按钮是"删除"不是"确定"!
          const deleteConfirmBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
          if (await deleteConfirmBtn.count() > 0 && await deleteConfirmBtn.isVisible().catch(() => false)) {
            await deleteConfirmBtn.click({ force: true });
            console.log('✓ 已删除');
            await page.waitForTimeout(1500);
            deleted = true;
          }
          break;
        }
      }

      if (!deleted) {
        console.log('无法删除，可能需要别的确认方式');
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`最终字段: ${fields.join(' | ')}`);

    // 验证
    if (fields.includes('订单明细')) {
      const subIdx = fields.indexOf('订单明细');
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(1000);
      const text = await readPage(page);
      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确' : '✗ 有问题'}`);
      if (!ok) {
        console.log(`关联表部分: ${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 200)}`);
      }
    }

    await page.screenshot({ path: 'screenshots/clean-v3.png', fullPage: true });
    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
