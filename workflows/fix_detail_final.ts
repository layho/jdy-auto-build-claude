/**
 * 修复订单明细表：
 * 1. 正确删除"订单管理"字段（确认弹窗按钮是"删除"）
 * 2. 设置权限
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
  console.log('[FIX DETAIL FINAL]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // ====== 1. 进入订单明细表编辑器，删除"订单管理"字段 ======
    console.log('====== 1. 删除订单管理字段 ======');
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    await detailEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await detailEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    const orderMgmtIdx = fields.indexOf('订单管理');
    if (orderMgmtIdx >= 0) {
      console.log('删除"订单管理"关联数据字段...');
      const fieldEl = page.locator('.fx-field-layout.field').nth(orderMgmtIdx);
      await fieldEl.click({ force: true });
      await page.waitForTimeout(600);

      const deleteBtn = fieldEl.locator('.btn-delete.btn-trash').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(1000);

        // 确认弹窗 - 按钮是"删除"不是"确定"！
        let text = await readPage(page);
        console.log(`确认弹窗:\n${text.substring(text.indexOf('确定删除'), text.indexOf('确定删除') + 200)}`);

        // 点击"删除"按钮确认
        const deleteConfirm = page.locator('[class*="alert"] button:has-text("删除")').last();
        if (await deleteConfirm.count() > 0 && await deleteConfirm.isVisible().catch(() => false)) {
          await deleteConfirm.click({ force: true });
          console.log('✓ 已确认删除');
          await page.waitForTimeout(1500);
        }
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`清理后字段: ${fields.join(' | ')}`);

    // ====== 2. 设置权限：切换到表单发布 ======
    console.log('\n====== 2. 设置权限 ======');

    // 确保在编辑器中，点击表单发布tab
    // 先检查是否在字段属性面板中，如果是，需要先关闭
    let text = await readPage(page);
    const inFieldProp = text.includes('字段属性') && text.includes('表单属性');

    // 使用更准确的方法点击tab
    const allTabs = page.locator('.tab-header-item.form-tab-item');
    const tabCount = await allTabs.count();
    console.log(`Tab数量: ${tabCount}`);

    for (let i = 0; i < tabCount; i++) {
      const tab = allTabs.nth(i);
      const tabText = await tab.innerText().catch(() => '');
      console.log(`  Tab[${i}]: "${tabText}"`);
      if (tabText.includes('表单发布')) {
        await tab.click({ force: true });
        console.log('✓ 已点击表单发布tab');
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
        break;
      }
    }

    text = await readPage(page);
    console.log(`\n表单发布页面内容:\n${text.substring(0, 2000)}`);
    await page.screenshot({ path: 'screenshots/detail-publish-v3.png', fullPage: true });

    // 检查是否真的在发布页
    const isPublish = text.includes('表单发布') && (text.includes('添加成员') || text.includes('权限组') || text.includes('成员') || text.includes('谁可以'));
    console.log(`是否在发布页: ${isPublish}`);

    // 查找添加成员按钮
    const allButtons = await page.$$eval('button', els =>
      els.filter(el => (el as HTMLElement).offsetHeight > 0)
        .map(el => el.textContent?.trim()?.substring(0, 30))
    );
    console.log(`可见按钮: ${allButtons.join(' | ')}`);

    // 如果有"添加成员"按钮
    const addMemberBtn = page.locator('button:has-text("添加成员")').first();
    if (await addMemberBtn.count() > 0 && await addMemberBtn.isVisible().catch(() => false)) {
      await addMemberBtn.click({ force: true });
      console.log('✓ 已点击添加成员');
      await page.waitForTimeout(2000);

      text = await readPage(page);
      console.log(`添加成员弹窗:\n${text.substring(0, 1000)}`);

      // 搜索齐妍娜
      const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="请输入"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('齐妍娜');
        await page.waitForTimeout(1000);
      }

      // 勾选
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.count() > 0 && await checkbox.isVisible().catch(() => false)) {
        await checkbox.click({ force: true });
        await page.waitForTimeout(500);
      }

      // 确定
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1500);
        console.log('✓ 成员已添加');
      }
    }

    // 检查权限级别 - 查找可点击修改的权限文本
    text = await readPage(page);
    console.log(`\n发布页状态:\n${text.substring(0, 1500)}`);

    // 查找权限标签
    const permCheck = ['仅添加数据', '添加并管理本人数据', '添加并查看全部数据', '管理全部数据', '查看全部数据'];
    for (const p of permCheck) {
      const el = page.locator(`text=${p}`).first();
      const c = await el.count();
      if (c > 0) {
        const vis = await el.isVisible().catch(() => false);
        console.log(`权限 "${p}": count=${c} visible=${vis}`);
      }
    }

    await page.screenshot({ path: 'screenshots/detail-perm-v3.png', fullPage: true });
    console.log('\n====== 修复完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
