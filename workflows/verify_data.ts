/**
 * 通过数据管理视图验证数据是否存在
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
  console.log('[VERIFY DATA]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // 先验证客户和产品的数据
    for (const formName of ['客户信息', '产品信息', '订单管理']) {
      console.log(`\n====== ${formName} ======`);
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(2000);

      await page.locator('.tree-node').filter({ hasText: formName }).first().click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const text = await readPage(page);

      // 如果显示的是表单录入页，尝试进入数据管理
      if (text.includes('提交') && !text.includes('数据标题')) {
        console.log('  当前在表单录入页，切换到数据管理...');

        // 点编辑器顶部的"数据管理"tab 或上方的"数据管理"按钮
        const dataMgmtBtn = page.locator('button:has-text("数据管理"), .tab-header-item:has-text("数据管理")').first();
        if (await dataMgmtBtn.count() > 0) {
          await dataMgmtBtn.click({ force: true });
          await page.waitForTimeout(3000);
          await waitForStableDOM(page);
        } else {
          // 可能在数据录入页的顶部有"数据管理"按钮（不在editor里）
          const topDataBtn = page.locator('button:has-text("数据管理")').last();
          if (await topDataBtn.count() > 0) {
            await topDataBtn.click({ force: true });
            await page.waitForTimeout(3000);
            await waitForStableDOM(page);
          }
        }
      }

      const text2 = await readPage(page);
      console.log(`  页面内容:\n  ${text2.substring(0, 600).replace(/\n/g, '\n  ')}`);

      // 检查是否有数据
      const hasData = text2.includes('13800138000') || text2.includes('张三')
        || text2.includes('智能手机') || text2.includes('标准版')
        || text2.includes('ORD-') || text2.includes('ORD');
      console.log(`  有数据: ${hasData}`);

      // 查看表格行
      const tableRows = await page.$$eval('[class*="table-row"], [class*="table-body"] [class*="row"], tr', els =>
        els.filter(el => el.offsetHeight > 20).map(el => el.textContent?.trim().substring(0, 80))
      );
      console.log(`  表格行: ${tableRows.slice(0, 5).join(' | ')}`);
    }

    console.log('\n====== 验证完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
