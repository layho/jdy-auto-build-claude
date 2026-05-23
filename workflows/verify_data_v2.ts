/**
 * 最终验证 V2 - 检查订单明细表数据
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
  console.log('[VERIFY DATA V2]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // 1. 先看订单管理列表确认数据存在
    console.log('====== 1. 订单管理 ======');
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 点击 ORD-20260523-NET 查看详情
    const netRow = page.locator('tr:has-text("ORD-20260523-NET")').first();
    if (await netRow.count() > 0) {
      await netRow.click({ force: true });
      console.log('✓ 找到 ORD-NET 记录');
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const detail = await page.locator('body').first().innerText().catch(() => '');
      console.log(`详情:\n${detail.substring(0, 3000)}`);

      const subInDetail = await page.evaluate(() => {
        const subtable = document.querySelector('.fx-related-form');
        if (!subtable) return { error: 'no subtable in detail' };
        const cells = [...subtable.querySelectorAll('.related-form-cell')];
        return {
          cellCount: cells.length,
          cellTexts: cells.map(c => (c as HTMLElement).innerText?.trim()),
          fullText: (subtable as HTMLElement).innerText?.trim()?.substring(0, 500),
        };
      });
      console.log(`\n详情子表: ${JSON.stringify(subInDetail, null, 2)}`);
    } else {
      console.log('未找到 ORD-NET 记录');
    }

    await page.screenshot({ path: 'screenshots/verify-v2-detail.png', fullPage: true });

    // 2. 检查订单明细表 - 使用数据管理视图
    console.log('\n====== 2. 订单明细表数据管理 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单明细表' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let detailText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`初始:\n${detailText.substring(0, 1000)}`);

    // 尝试切换到数据管理
    // 方法1: 查找并点击 "数据管理" 链接/按钮
    const dataMgmtLinks = page.locator('text=数据管理');
    const dmCount = await dataMgmtLinks.count();
    console.log(`\n'数据管理'链接数: ${dmCount}`);

    for (let i = 0; i < dmCount; i++) {
      const el = dataMgmtLinks.nth(i);
      const tag = await el.evaluate(e => e.tagName);
      const visible = await el.isVisible().catch(() => false);
      const rect = await el.boundingBox().catch(() => null);
      console.log(`  [${i}] tag=${tag} visible=${visible} rect=${JSON.stringify(rect)}`);
      if (visible && rect) {
        await el.click({ force: true });
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
        detailText = await page.locator('body').first().innerText().catch(() => '');
        console.log(`  点击后:\n${detailText.substring(0, 800)}`);
        break;
      }
    }

    // 如果还在表单页，尝试找 "仅添加数据" 切换
    if (detailText.includes('仅添加数据')) {
      console.log('\n切换到管理全部数据...');
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
      detailText = await page.locator('body').first().innerText().catch(() => '');
      console.log(`切换后:\n${detailText.substring(0, 2000)}`);
    }

    const hasPhone = detailText.includes('智能手机');
    const hasOrd = detailText.includes('ORD');
    const has2999 = detailText.includes('2999');
    console.log(`\n结果: 智能手机=${hasPhone}, ORD=${hasOrd}, 2999=${has2999}`);

    await page.screenshot({ path: 'screenshots/verify-v2-table.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
