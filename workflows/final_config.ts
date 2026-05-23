/**
 * 最终配置：检查并完成订单管理表单的三个关联字段
 * - 关联数据 → 关联客户信息 ✓（已配置，需验证）
 * - 关联子表 → 订单明细表（表单已创建，需配置显示字段）
 * - 选择数据 → 选择产品信息（需添加和配置）
 *
 * 原则：先读内容再操作，不盲目点
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
  console.log('[FINAL] 完成订单管理表单配置\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { browser, context, page } = s;
    await login(page);

    // 进入订单管理编辑器
    console.log('1. 进入订单管理编辑器...');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const formEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await formEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await formEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 读取整个页面内容
    let text = await readPage(page);
    console.log(`\n====== 完整页面内容 ======`);
    console.log(text);
    console.log(`\n====== 内容结束 ======`);

    await page.screenshot({ path: 'screenshots/final-initial.png', fullPage: true });

    // 分析字段：在"字段回收站"和"字段属性"之间的内容就是表单画布的字段
    const fieldStartIdx = text.indexOf('字段回收站');
    const fieldEndIdx = text.indexOf('字段属性');
    if (fieldStartIdx >= 0 && fieldEndIdx > fieldStartIdx) {
      const fieldArea = text.substring(fieldStartIdx, fieldEndIdx);
      console.log(`\n表单画布字段区域:\n${fieldArea}`);

      // 检查重复字段
      const fields = fieldArea.split('\n').filter(l => l.trim().length > 0 && l.trim() !== '字段回收站');
      console.log(`\n识别到的字段行: ${JSON.stringify(fields)}`);
    }

    // 检查关联数据配置
    if (text.includes('已和') && text.includes('建立关联')) {
      const assocMatch = text.match(/已和(.+?)建立关联/);
      console.log(`\n✓ 关联数据已配置，关联到: ${assocMatch?.[1]?.trim() || '未知'}`);
    }

    // 检查关联子表
    if (text.includes('关联子表')) {
      console.log('\n发现关联子表相关内容');
      if (text.includes('订单明细表')) {
        console.log('✓ 关联子表已关联到: 订单明细表');
      }
    }

    // 检查选择数据
    if (text.includes('选择数据')) {
      console.log('\n发现选择数据相关内容');
    } else {
      console.log('\n⚠ 未找到选择数据字段，需要添加');
    }

    console.log('\n====== 状态检查完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
