/**
 * 1. 检查订单管理表单当前字段状态
 * 2. 清理错误的字段
 * 3. 正确配置三个关联字段
 *
 * 官方文档：
 * - 关联数据: 添加字段 → 选择主表 → 设置显示字段
 * - 关联子表: 添加字段 → 从空白新建 → 设计关联表 → 在新标签页添加字段
 * - 选择数据: 添加字段 → 选择数据源 → 设置显示字段/填充规则
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
  console.log('[CLEAN+CONFIG] 清理并配置关联字段\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入编辑器 ======
    console.log('====== 1. 进入订单管理编辑器 ======');
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

    // ====== 2. 检查当前字段 ======
    console.log('\n====== 2. 检查当前字段 ======');
    await page.screenshot({ path: 'screenshots/before-clean.png', fullPage: true });
    let text = await readPage(page);
    console.log(`页面内容:\n${text.substring(0, 2000)}`);

    // 找表单画布中的字段
    const fieldItems = await page.$$eval('[class*="field-item"]', els =>
      els.map(el => {
        const text = el.textContent?.trim() || '';
        const cls = (el as HTMLElement).className?.substring(0, 100) || '';
        return { text: text.substring(0, 60), class: cls };
      })
    );
    console.log(`\n字段列表 (按class field-item):`);
    fieldItems.forEach((f, i) => console.log(`  [${i}] "${f.text}" class="${f.class}"`));

    // 也找 fx-field-item
    const fxFields = await page.$$eval('[class*="fx-field"]', els =>
      els.map(el => ({
        text: (el.textContent?.trim() || '').substring(0, 80),
        class: (el as HTMLElement).className?.substring(0, 120),
      }))
    );
    console.log(`\nfx-field 元素:`);
    fxFields.filter(f => f.text.length > 0).forEach((f, i) => console.log(`  [${i}] "${f.text}" class="${f.class}"`));

    // 查找关联客户的配置错误提示
    if (text.includes('配置有误')) {
      console.log('\n⚠ 检测到配置错误！需要修复。');

      // 尝试点击错误提示旁边的"配置"按钮
      const errorMsg = page.locator('text=配置有误').first();
      if (await errorMsg.count() > 0) {
        console.log('  找到"配置有误"，尝试修复...');
        // 可能需要重新配置选择主表
      }
    }

    // ====== 3. 找并点击"选择主表"错误 ======
    // 关联数据字段已经有一个标题为"关联客户"，需要确保主表已选择
    // 先点表单画布上的关联客户字段
    console.log('\n====== 3. 修复关联数据配置 ======');

    // Playwright click on field in canvas
    const assocField = page.locator('[class*="field"]:has-text("关联客户")').first();
    if (await assocField.count() > 0) {
      console.log('  点击"关联客户"字段...');
      await assocField.click({ force: true });
      await page.waitForTimeout(1000);

      text = await readPage(page);
      console.log(`  属性面板:\n    ${text.substring(text.indexOf('标题'), text.indexOf('标题') + 500).replace(/\n/g, '\n    ')}`);

      // 查看是否有"选择主表"下拉，当前选择了什么
      const dropdownVal = page.locator('.link-form-combo .value-content').first();
      if (await dropdownVal.count() > 0) {
        const val = await dropdownVal.innerText().catch(() => '');
        console.log(`  当前选择: "${val}"`);
      }

      // 如果主表为空，重新选择
      if (text.includes('配置有误')) {
        const dropdown = page.locator('.link-form-combo .x-biz-dropdown-label').first();
        await dropdown.click({ force: true });
        await page.waitForTimeout(1000);

        // 选"客户信息"
        const customerOpt = page.locator('[class*="option"]:has-text("客户信息")').first();
        if (await customerOpt.count() > 0) {
          await customerOpt.click({ force: true });
          console.log('  重新选择主表: 客户信息');
          await page.waitForTimeout(500);

          // 保存
          await page.locator('button:has-text("保存")').first().click({ force: true });
          console.log('  ✓ 已保存关联数据修复');
          await page.waitForTimeout(2000);
        }
      }
    }

    // ====== 4. 处理关联子表 ======
    console.log('\n====== 4. 配置关联子表 ======');
    text = await readPage(page);
    if (text.includes('订单明细')) {
      console.log('  "订单明细"字段已存在');
    }

    // 点关联子表 widget（如果还没加）
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'screenshots/subtable-config.png', fullPage: true });
    text = await readPage(page);
    console.log(`  页面内容:\n    ${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 500).replace(/\n/g, '\n    ')}`);

    // 看看有没有"从空白新建"
    const createBlank = page.locator('text=从空白新建').first();
    if (await createBlank.count() > 0 && await createBlank.isVisible().catch(() => false)) {
      console.log('  点击"从空白新建"...');
      await createBlank.click({ force: true });
      await page.waitForTimeout(1000);

      // 找表单名称输入框
      const formNameInput = page.locator('[class*="dialog"] input.input-inner').first();
      if (await formNameInput.count() > 0) {
        await formNameInput.click({ clickCount: 3, force: true });
        await formNameInput.fill('订单明细表');
        console.log('  输入: 订单明细表');
        await page.waitForTimeout(300);
      }

      // 点击"设计关联表"（不是"确定"！）
      text = await readPage(page);
      console.log(`  弹窗:\n    ${text.substring(0, 2000).replace(/\n/g, '\n    ')}`);

      const designBtn = page.locator('button:has-text("设计关联表")').first();
      console.log(`  "设计关联表"按钮: ${await designBtn.count()}`);

      if (await designBtn.count() > 0) {
        await designBtn.click({ force: true });
        console.log('  点击"设计关联表"...');
        await page.waitForTimeout(3000);
        await waitForStableDOM(page);

        console.log(`  当前URL: ${page.url()}`);
        await page.screenshot({ path: 'screenshots/subtable-designer.png', fullPage: true });
      }
    }

    await page.screenshot({ path: 'screenshots/after-config.png', fullPage: true });
    console.log('\n====== 完成！ ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
