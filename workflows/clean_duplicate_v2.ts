/**
 * 清理重复字段 V2：直接点击可见的删除图标
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
  console.log('[CLEAN DUPLICATE V2]\n');
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

    // 找所有"订单明细"并删除损坏的
    const orderDetailIndices: number[] = [];
    fields.forEach((f, i) => {
      if (f === '订单明细') orderDetailIndices.push(i);
    });

    if (orderDetailIndices.length > 1) {
      // 逐个检查
      for (let idx = 0; idx < orderDetailIndices.length; idx++) {
        const fieldIdx = orderDetailIndices[idx];
        const fieldEl = page.locator('.fx-field-layout.field').nth(fieldIdx);
        await fieldEl.click({ force: true });
        await page.waitForTimeout(800);

        const text = await readPage(page);
        const isBroken = text.includes('已删除') || text.includes('关联不存在') || text.includes('没有可选择');

        if (isBroken) {
          console.log(`订单明细[${fieldIdx}] 损坏，删除...`);

          // 找可见的删除图标并点击
          const visibleDeleteIcons = page.locator('i.btn-delete.btn-trash').filter({ has: page.locator(':visible') });
          // 上面的filter可能不工作，换一种方式
          const allIcons = page.locator('i.btn-delete.btn-trash');
          const iconCount = await allIcons.count();

          for (let i = 0; i < iconCount; i++) {
            const icon = allIcons.nth(i);
            const vis = await icon.isVisible().catch(() => false);
            if (vis) {
              console.log(`  点击删除图标 [${i}]`);
              await icon.click({ force: true });
              await page.waitForTimeout(1000);

              // 确认弹窗
              const confirmText = await readPage(page);
              if (confirmText.includes('确定删除')) {
                const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
                if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
                  await confirmBtn.click({ force: true });
                  console.log('  ✓ 已删除');
                  await page.waitForTimeout(1000);
                }
              }
              break;
            }
          }

          break; // 只删一个
        } else {
          console.log(`订单明细[${fieldIdx}] 正常，保留`);
        }
      }
    } else {
      console.log('只有一个订单明细，无需清理');
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`最终字段: ${fields.join(' | ')}`);

    // 验证唯一一个订单明细的关联状态
    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(1000);
      const text = await readPage(page);
      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确' : '✗ 有问题'}`);
    }

    await page.screenshot({ path: 'screenshots/clean-duplicate-v2.png', fullPage: true });
    console.log('\n====== 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
