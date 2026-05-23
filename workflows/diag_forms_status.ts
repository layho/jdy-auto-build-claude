/**
 * 诊断所有表单的状态，特别是订单明细表是否还可用
 * 同时检查订单明细表的编辑器是否能正常打开
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
  console.log('[DIAG FORMS STATUS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // ====== 1. 列出所有表单和它们的节点信息 ======
    const formNodes = await page.$$eval('.tree-node', els =>
      els.map(el => {
        const nameEl = el.querySelector('.entry-name');
        const iconEl = el.querySelector('i, svg, [class*="icon"]');
        return {
          name: nameEl?.textContent?.trim() || '',
          className: el.className?.substring(0, 100),
          hasIcon: !!iconEl,
          iconClass: iconEl?.className?.substring(0, 100) || '',
        };
      })
    );
    console.log('=== 表单列表 ===');
    formNodes.forEach((n, i) => console.log(`  [${i}] ${n.name} (class="${n.className}")`));

    // ====== 2. 检查订单明细表能否进入编辑器 ======
    console.log('\n=== 检查订单明细表 ===');
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    const detailCount = await detailEntry.count();
    console.log(`订单明细表存在: ${detailCount > 0}`);

    if (detailCount > 0) {
      // 悬停看context menu
      await detailEntry.hover({ force: true });
      await page.waitForTimeout(600);
      await detailEntry.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(600);

      const menuItems = await page.$$eval('li', els =>
        els.filter(el => (el as HTMLElement).offsetHeight > 0)
          .map(el => el.textContent?.trim()?.substring(0, 30))
      );
      console.log(`Context menu: ${menuItems.join(' | ')}`);

      // 点击编辑进入
      await page.locator('li:has-text("编辑")').last().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);
      await page.waitForTimeout(2000);

      let text = await readPage(page);
      console.log(`\n编辑器内容:\n${text.substring(0, 1500)}`);

      // 看字段列表
      const fields = await page.$$eval('.fx-field-layout.field', els =>
        els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
      );
      console.log(`\n订单明细表字段: ${fields.join(' | ')}`);

      // 检查表单属性 - 看是否是子表单
      // 点"表单属性"tab
      const formPropTab = page.locator('.tab-header-item:has-text("表单属性")').first();
      if (await formPropTab.count() > 0) {
        await formPropTab.click({ force: true });
        await page.waitForTimeout(1000);
        text = await readPage(page);
        console.log(`\n表单属性:\n${text.substring(0, 1500)}`);
      }

      await page.screenshot({ path: 'screenshots/diag-detail-form.png', fullPage: true });

      // 回到首页
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(2000);
    }

    // ====== 3. 检查是否有其他关联表 ======
    console.log('\n=== 检查关联表引用 ===');
    // 看看"订单管理"的关联子表配置
    const orderEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await orderEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let text = await readPage(page);
    const fields2 = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`订单管理字段: ${fields2.join(' | ')}`);

    // 如果订单明细字段存在，点击查看
    if (fields2.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);
      const relIdx = text.indexOf('关联表');
      if (relIdx >= 0) {
        console.log(`\n关联表配置:\n${text.substring(relIdx, relIdx + 500)}`);
      }
    }

    await page.screenshot({ path: 'screenshots/diag-order-editor.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
