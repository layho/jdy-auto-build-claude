/**
 * 清理订单管理上的重复字段：
 * 1. 检查所有"订单明细"字段
 * 2. 删除损坏的，保留正确的
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
  console.log('[CLEAN DUPLICATE FIELDS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // 进入编辑器
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

    // 找到所有"订单明细"字段的索引
    const orderDetailIndices: number[] = [];
    fields.forEach((f, i) => {
      if (f === '订单明细') orderDetailIndices.push(i);
    });
    console.log(`订单明细字段位置: ${orderDetailIndices.join(', ')}`);

    if (orderDetailIndices.length <= 1) {
      console.log('只有一个订单明细字段，无需清理');
    } else {
      // 点击每个"订单明细"字段检查关联状态，删除损坏的
      for (let idx = 0; idx < orderDetailIndices.length; idx++) {
        const fieldIdx = orderDetailIndices[idx];
        console.log(`\n检查订单明细 [${fieldIdx}]...`);

        const fieldEl = page.locator('.fx-field-layout.field').nth(fieldIdx);
        await fieldEl.click({ force: true });
        await page.waitForTimeout(1000);

        const text = await readPage(page);
        const isBroken = text.includes('已删除') || text.includes('关联不存在') || text.includes('没有可选择');
        console.log(`  关联状态: ${isBroken ? '损坏' : '正常'}`);

        if (isBroken) {
          console.log(`  尝试删除...`);

          // 方法1: 找删除按钮 - 检查 form-widget-mask
          const maskDeleteBtn = page.locator('.form-widget-mask i.btn-delete.btn-trash').first();
          console.log(`  mask中删除按钮: ${await maskDeleteBtn.count()}个`);

          // 方法2: 找所有可见的删除图标
          const allDeleteIcons = page.locator('i.btn-delete, i.icon-trash, [title="删除"]');
          console.log(`  所有删除图标: ${await allDeleteIcons.count()}个`);

          for (let i = 0; i < await allDeleteIcons.count(); i++) {
            const icon = allDeleteIcons.nth(i);
            const vis = await icon.isVisible().catch(() => false);
            const cls = await icon.getAttribute('class').catch(() => '');
            console.log(`    [${i}] visible=${vis} class="${cls}"`);
          }

          // 方法3: 直接用键盘删除
          console.log(`  尝试键盘Delete...`);
          await page.keyboard.press('Delete');
          await page.waitForTimeout(1000);

          // 检查确认弹窗
          let text2 = await readPage(page);
          if (text2.includes('确定删除')) {
            const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
            if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
              await confirmBtn.click({ force: true });
              console.log('  ✓ 已确认删除');
              await page.waitForTimeout(1000);
            }
          } else {
            // 尝试Backspace
            console.log(`  尝试键盘Backspace...`);
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(1000);
            text2 = await readPage(page);
            if (text2.includes('确定删除')) {
              const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
              if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
                await confirmBtn.click({ force: true });
                console.log('  ✓ 已确认删除(Backspace)');
                await page.waitForTimeout(1000);
              }
            }
          }

          // 检查是否删除成功
          const remainingFields = await page.$$eval('.fx-field-layout.field', els =>
            els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
          );
          console.log(`  删除后字段: ${remainingFields.join(' | ')}`);

          // 更新索引（因为删除了一个字段，后面的索引会前移）
          break; // 只删除第一个损坏的
        }
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('\n✓ 已保存');
    await page.waitForTimeout(2000);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`最终字段: ${fields.join(' | ')}`);

    await page.screenshot({ path: 'screenshots/clean-duplicate.png', fullPage: true });
    console.log('\n====== 清理完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
