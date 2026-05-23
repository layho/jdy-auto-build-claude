/**
 * 重建订单管理表单：
 * 1. 删除重复字段
 * 2. 确保基础字段存在（订单编号、下单日期）
 * 3. 确保三个关联字段正确配置
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

async function saveForm(page: Page): Promise<void> {
  const saveBtn = page.locator('button:has-text("保存")').first();
  if (await saveBtn.count() > 0 && await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click({ force: true });
    console.log('  ✓ 已保存');
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
  }
}

async function main() {
  console.log('[REBUILD] 重建订单管理表单\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入编辑器 ======
    console.log('进入订单管理编辑器...');
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

    // ====== 列出表单画布中的所有字段 ======
    console.log('\n====== 当前字段列表 ======');
    const fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const cls = (el as HTMLElement).className;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 100);
        const hasWarning = cls.includes('error') || text.includes('配置有误');
        return { class: cls.substring(0, 100), text, hasWarning };
      })
    );
    fields.forEach((f, i) => console.log(`  [${i}] "${f.text}" warning=${f.hasWarning}`));

    // ====== 删除重复/错误字段 ======
    console.log('\n====== 删除重复字段 ======');
    for (let i = fields.length - 1; i >= 0; i--) {
      const f = fields[i];
      if (f.text.includes('在右侧设置关联') || f.hasWarning) {
        console.log(`  删除字段[${i}]: "${f.text.substring(0, 40)}..."`);
        const fieldEl = page.locator('.fx-field-layout.field').nth(i);

        // Hover显示操作按钮
        await fieldEl.hover({ force: true });
        await page.waitForTimeout(500);

        // 找删除按钮 - 通常在字段右上角
        const deleteBtn = fieldEl.locator('[class*="delete"], [class*="remove"], [class*="close"], button:has-text("删除")').first();
        if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
          await deleteBtn.click({ force: true });
          console.log('    → 已删除');
          await page.waitForTimeout(1000);
        } else {
          // 尝试按Delete键
          console.log('    尝试Delete键...');
          await fieldEl.click({ force: true });
          await page.waitForTimeout(300);
          await page.keyboard.press('Delete');
          await page.waitForTimeout(1000);
          console.log('    → 已按Delete');
        }
      }
    }

    await saveForm(page);

    // ====== 添加基础字段 ======
    console.log('\n====== 添加基础字段 ======');
    let text = await readPage(page);

    // 检查订单编号是否存在
    if (!text.includes('订单编号')) {
      console.log('  添加 订单编号...');
      await page.locator('li.form-edit-widget-label:has-text("单行文本")').first().click({ force: true });
      await page.waitForTimeout(800);
      const input = page.locator('.fx-field-title-input input.input-inner').last();
      await input.click({ clickCount: 3, force: true }).catch(() => {});
      await input.fill('订单编号').catch(() => {});
      await page.waitForTimeout(400);
    } else {
      console.log('  订单编号 已存在');
    }

    // 检查下单日期是否存在
    if (!text.includes('下单日期')) {
      console.log('  添加 下单日期...');
      await page.locator('li.form-edit-widget-label:has-text("日期时间")').first().click({ force: true });
      await page.waitForTimeout(800);
      const input = page.locator('.fx-field-title-input input.input-inner').last();
      await input.click({ clickCount: 3, force: true }).catch(() => {});
      await input.fill('下单日期').catch(() => {});
      await page.waitForTimeout(400);
    } else {
      console.log('  下单日期 已存在');
    }

    await saveForm(page);

    // ====== 配置关联数据 ======
    console.log('\n====== 配置关联数据 ======');
    text = await readPage(page);
    if (text.includes('已和') && text.includes('建立关联')) {
      console.log('  ✓ 关联数据已配置');
    } else {
      console.log('  添加关联数据...');
      await page.locator('li.form-edit-widget-label:has-text("关联数据")').first().click({ force: true });
      await page.waitForTimeout(1500);

      // 设标题
      const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
      await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
      await titleInput.fill('关联客户').catch(() => {});
      await page.waitForTimeout(400);

      // 选择主表
      const dropdown = page.locator('.link-form-combo .x-biz-dropdown-label').first();
      if (await dropdown.count() > 0) {
        await dropdown.click({ force: true });
        await page.waitForTimeout(1000);

        const opt = page.locator('[class*="option"]:has-text("客户信息")').first();
        if (await opt.count() > 0) {
          await opt.click({ force: true });
          console.log('  ✓ 已关联客户信息');
          await page.waitForTimeout(500);
        }
      }
    }

    await saveForm(page);

    // ====== 配置关联子表 ======
    console.log('\n====== 配置关联子表 ======');
    text = await readPage(page);
    if (text.includes('订单明细表')) {
      console.log('  ✓ 关联子表已关联订单明细表');
    } else if (text.includes('订单明细')) {
      console.log('  关联子表字段存在但可能未绑定...');
    } else {
      console.log('  添加关联子表...');
      await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
      await page.waitForTimeout(1500);

      const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
      await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
      await titleInput.fill('订单明细').catch(() => {});
      await page.waitForTimeout(400);

      // 选择关联表 - 点下拉选订单明细表
      text = await readPage(page);
      console.log(`  面板: ${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 200).replace(/\n/g, ' ')}`);

      // 如果"订单明细表"已经在选项中，直接选
      const orderDetailOpt = page.locator('[class*="option"]:has-text("订单明细表")').first();
      if (await orderDetailOpt.count() > 0 && await orderDetailOpt.isVisible().catch(() => false)) {
        await orderDetailOpt.click({ force: true });
        console.log('  ✓ 已绑定订单明细表');
      }
    }

    await saveForm(page);

    // ====== 配置选择数据 ======
    console.log('\n====== 配置选择数据 ======');
    text = await readPage(page);
    if (!text.includes('选择产品')) {
      console.log('  添加选择数据...');
      await page.locator('li.form-edit-widget-label:has-text("选择数据")').first().click({ force: true });
      await page.waitForTimeout(1500);

      // 设标题
      const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
      await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
      await titleInput.fill('选择产品').catch(() => {});
      await page.waitForTimeout(400);

      // 读取属性面板找"数据源"
      text = await readPage(page);
      console.log(`  选择数据面板:\n    ${text.substring(text.indexOf('标题'), text.indexOf('标题') + 600).replace(/\n/g, '\n    ')}`);

      // 找数据源下拉 - 选择数据使用不同的class
      const dataSourceDropdown = page.locator('.x-biz-entry-select-combo .x-biz-dropdown-label, [class*="choose"] .x-biz-dropdown-label').first();
      if (await dataSourceDropdown.count() > 0) {
        await dataSourceDropdown.click({ force: true });
        await page.waitForTimeout(1000);

        text = await readPage(page);
        console.log(`  数据源选项:\n    ${text.substring(0, 2000).replace(/\n/g, '\n    ')}`);

        const productOpt = page.locator('[class*="option"]:has-text("产品信息")').first();
        if (await productOpt.count() > 0 && await productOpt.isVisible().catch(() => false)) {
          await productOpt.click({ force: true });
          console.log('  ✓ 数据源: 产品信息');
        } else {
          console.log('  未找到产品信息选项');
        }
      } else {
        console.log('  未找到数据源下拉');
        console.log('  可能是属性面板没有正确切换，尝试点击画布上的字段...');
      }
    } else {
      console.log('  选择数据字段已存在');
    }

    await saveForm(page);

    // ====== 最终截图 ======
    await page.screenshot({ path: 'screenshots/final-result.png', fullPage: true });

    text = await readPage(page);
    console.log(`\n====== 最终字段验证 ======`);
    [
      '订单编号', '下单日期',
      '关联客户', '客户信息',
      '订单明细', '订单明细表',
      '选择产品', '产品信息',
    ].forEach(kw => {
      console.log(`  ${text.includes(kw) ? '✓' : '✗'} ${kw}`);
    });

    console.log('\n====== 完成！ ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
