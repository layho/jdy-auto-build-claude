/**
 * 修复订单明细表权限 - 通过成员权限弹窗设置
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
  console.log('[FIX DETAIL PERM V5]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const entry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`初始:\n${text}`);

    // 检查是否已经在成员权限弹窗中（从上一次运行残留）
    if (text.includes('成员权限') && text.includes('取消') && text.includes('确定')) {
      console.log('\n--- 已在成员权限弹窗中 ---');
      // 点"添加并管理本人数据" 切换权限
      // 这很可能是一个下拉，在"成员权限"标签旁边
    } else {
      // 需要先删除旧分组，重新添加
      console.log('\n--- 删除旧分组 ---');
      const deleteBtn = page.locator('button:has-text("删除")').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(1000);
        const alertText = await page.locator('[class*="alert"]').first().innerText().catch(() => '');
        console.log(`删除确认: ${alertText.substring(0, 200)}`);
        const confirmDel = page.locator('button:has-text("确定")').last();
        if (await confirmDel.count() > 0) await confirmDel.click({ force: true });
        await page.waitForTimeout(2000);
      }

      // 重新添加成员
      console.log('\n--- 添加成员 ---');
      await page.locator('button:has-text("添加成员"), span:has-text("添加成员")').first().click({ force: true });
      await page.waitForTimeout(2000);

      const searchInput = page.locator('input[placeholder*="搜索"], input.input-inner').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('齐妍娜');
        await page.waitForTimeout(2000);

        const checkbox = page.locator('input[type="checkbox"]').first();
        if (await checkbox.count() > 0) await checkbox.click({ force: true });
        await page.waitForTimeout(500);
      }

      await page.locator('button:has-text("确定")').last().click({ force: true });
      console.log('成员已添加');
      await page.waitForTimeout(2000);
    }

    // 现在应该在成员权限设置弹窗中
    text = await readPage(page);
    console.log(`\n成员权限弹窗:\n${text}`);

    // 找"成员权限"标签下面的"添加并管理本人数据"并点击
    // 它可能在 text=添加并管理本人数据 附近
    if (text.includes('成员权限') && text.includes('添加并管理本人数据')) {
      console.log('\n--- 切换权限级别 ---');
      // 点击"添加并管理本人数据"
      const permValue = page.locator('text=添加并管理本人数据').last();
      if (await permValue.count() > 0) {
        await permValue.click({ force: true });
        await page.waitForTimeout(1000);

        text = await readPage(page);
        console.log(`下拉后:\n${text.substring(0, 800)}`);

        // 选管理全部数据
        const manageAll = page.locator('[class*="option"]:has-text("管理全部数据"), li:has-text("管理全部数据")').first();
        if (await manageAll.count() > 0 && await manageAll.isVisible().catch(() => false)) {
          await manageAll.click({ force: true });
          console.log('✓ 已选择管理全部数据');
          await page.waitForTimeout(500);
        } else {
          // 尝试直接文本点击
          await page.locator('text=管理全部数据').last().click({ force: true }).catch(() => {});
          console.log('尝试文本点击管理全部数据');
          await page.waitForTimeout(500);
        }
      }
    }

    // 确认
    const confirmBtn = page.locator('button:has-text("确定")').last();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('✓ 权限已确认');
      await page.waitForTimeout(2000);
    }

    // 最终验证
    text = await readPage(page);
    console.log(`\n====== 最终验证 ======`);
    console.log(`齐妍娜: ${text.includes('齐妍娜')}`);
    console.log(`管理全部数据: ${text.includes('管理全部数据')}`);
    if (text.includes('管理全部数据')) {
      console.log('✓ 权限设置成功！');
    } else {
      console.log('完整页面:\n' + text);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
