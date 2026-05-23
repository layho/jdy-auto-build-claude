/**
 * 配置新的订单明细表：
 * 1. 添加字段：产品名称(单行文本), 数量(数字), 单价(数字), 金额(数字)
 * 2. 设置权限：齐妍娜 管理全部数据
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
  console.log('[SETUP DETAIL FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // ====== 1. 进入订单明细表编辑器，添加字段 ======
    console.log('====== 1. 添加订单明细表字段 ======');
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    await detailEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await detailEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let text = await readPage(page);
    console.log(`编辑器:\n${text.substring(0, 800)}`);

    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ') || '(空)'}`);

    // 需要添加的字段
    const neededFields = [
      { name: '产品名称', widget: '单行文本' },
      { name: '数量', widget: '数字' },
      { name: '单价', widget: '数字' },
      { name: '金额', widget: '数字' },
    ];

    for (const field of neededFields) {
      if (!fields.includes(field.name)) {
        console.log(`添加字段: ${field.name} (${field.widget})...`);

        // 点击widget
        const widget = page.locator('li.form-edit-widget-label').filter({ hasText: field.widget }).first();
        await widget.click({ force: true });
        await page.waitForTimeout(800);

        // 设置字段名
        const fieldTitleInput = page.locator('.fx-field-title-input input.input-inner').last();
        await fieldTitleInput.click({ clickCount: 3, force: true }).catch(() => {});
        await fieldTitleInput.fill(field.name);
        await page.waitForTimeout(400);

        console.log(`  ✓ ${field.name} 已添加`);
      } else {
        console.log(`  - ${field.name} 已存在，跳过`);
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 字段已保存');
    await page.waitForTimeout(2000);

    // 验证
    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`最终字段: ${fields.join(' | ')}`);

    // ====== 2. 设置权限 ======
    console.log('\n====== 2. 设置权限 ======');

    // 点"表单发布"tab
    const publishTab = page.locator('.tab-header-item:has-text("表单发布")').first();
    if (await publishTab.count() > 0) {
      await publishTab.click({ force: true });
      await page.waitForTimeout(1500);
      await waitForStableDOM(page);
    }

    text = await readPage(page);
    console.log(`表单发布页:\n${text.substring(0, 1000)}`);

    await page.screenshot({ path: 'screenshots/detail-publish.png', fullPage: true });

    // 查找权限相关元素 - 看是否已有成员
    // 可能需要添加成员
    const addMemberBtn = page.locator('button:has-text("添加成员"), button:has-text("添加"), span:has-text("添加成员")').first();
    if (await addMemberBtn.count() > 0 && await addMemberBtn.isVisible().catch(() => false)) {
      console.log('点击添加成员...');
      await addMemberBtn.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      console.log(`添加成员弹窗:\n${text.substring(0, 800)}`);

      // 搜索齐妍娜
      const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="请输入"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('齐妍娜');
        await page.waitForTimeout(1000);
      }

      // 选择齐妍娜
      const qinaOption = page.locator('[class*="option"]:has-text("齐妍娜"), li:has-text("齐妍娜"), span:has-text("齐妍娜")').first();
      if (await qinaOption.count() > 0 && await qinaOption.isVisible().catch(() => false)) {
        await qinaOption.click({ force: true });
        await page.waitForTimeout(500);
        console.log('✓ 已选择齐妍娜');
      }

      // 确定
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        await page.waitForTimeout(1500);
        console.log('✓ 成员已添加');
      }
    }

    // 检查当前权限 - 可能需要点击权限组名来修改权限级别
    text = await readPage(page);
    console.log(`添加后:\n${text.substring(0, 1000)}`);

    // 查找权限级别文本并点击
    const permLabels = ['仅添加数据', '添加并管理本人数据', '添加并查看全部数据', '管理全部数据', '查看全部数据'];
    for (const label of permLabels) {
      const el = page.getByText(label, { exact: true }).first();
      if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
        console.log(`找到权限标签: "${label}"，点击修改...`);
        await el.click({ force: true });
        await page.waitForTimeout(1000);

        // 选择管理全部数据
        const manageAll = page.locator('[class*="option"]:has-text("管理全部数据"), li:has-text("管理全部数据")').first();
        if (await manageAll.count() > 0 && await manageAll.isVisible().catch(() => false)) {
          await manageAll.click({ force: true });
          console.log('✓ 已选择管理全部数据');
          await page.waitForTimeout(500);

          // 确定
          const confirmBtn2 = page.locator('button:has-text("确定")').last();
          if (await confirmBtn2.count() > 0 && await confirmBtn2.isVisible().catch(() => false)) {
            await confirmBtn2.click({ force: true });
            await page.waitForTimeout(1000);
          }
        }
        break;
      }
    }

    await page.screenshot({ path: 'screenshots/detail-perm-set.png', fullPage: true });

    // ====== 3. 验证订单管理中的关联子表 ======
    console.log('\n====== 3. 最终验证 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 进入订单管理编辑器
    const orderEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await orderEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const orderFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`订单管理字段: ${orderFields.join(' | ')}`);

    // 验证关联子表
    if (orderFields.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);

      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确' : '✗ 有问题'}`);

      // 检查显示字段
      const showFieldsIdx = text.indexOf('显示字段');
      if (showFieldsIdx >= 0) {
        console.log(`显示字段:\n${text.substring(showFieldsIdx, showFieldsIdx + 200)}`);
      }
    }

    await page.screenshot({ path: 'screenshots/subtable-final-verify.png', fullPage: true });
    console.log('\n====== 配置完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
