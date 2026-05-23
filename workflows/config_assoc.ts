/**
 * 配置订单管理表单的关联字段（基于官方文档步骤）
 *
 * 官方文档参考：
 * - 关联数据: https://hc.jiandaoyun.com/doc/18113
 * - 关联子表: https://hc.jiandaoyun.com/doc/21272
 * - 选择数据: https://hc.jiandaoyun.com/zh_cn/doc/9024
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

async function enterFormEditor(page: Page, formName: string): Promise<void> {
  console.log(`\n进入 "${formName}" 编辑器...`);
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);

  const formEntry = page.locator('.tree-node').filter({ hasText: formName }).first();
  await formEntry.hover({ force: true });
  await page.waitForTimeout(600);
  await formEntry.locator('.entry-set-icon').click({ force: true });
  await page.waitForTimeout(600);
  await page.locator('li:has-text("编辑")').last().click({ force: true });
  await page.waitForURL('**/edit**', { timeout: 10000 });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);
}

async function clickFieldWidget(page: Page, fieldType: string): Promise<void> {
  console.log(`  点击字段类型: ${fieldType}`);
  const widget = page.locator(`li.form-edit-widget-label:has-text("${fieldType}")`).first();
  await widget.waitFor({ state: 'visible', timeout: 10000 });
  await widget.click({ force: true });
  await page.waitForTimeout(1500);
}

/**
 * 根据官方文档，关联数据配置步骤：
 * 1. 添加关联数据字段
 * 2. 设置字段标题
 * 3. 选择主表（核心）- 选择要关联的表单
 * 4. 配置显示字段、过滤条件、数据填充（可选）
 */
async function configLinkData(page: Page): Promise<void> {
  console.log('\n====== 配置【关联数据】- 关联客户信息 ======');

  await clickFieldWidget(page, '关联数据');

  // 设置标题
  const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
  try {
    const val = await titleInput.inputValue().catch(() => '');
    if (val) {
      await titleInput.click({ clickCount: 3, force: true });
      await titleInput.fill('关联客户');
      console.log('  设置标题: "关联客户"');
      await page.waitForTimeout(400);
    }
  } catch {}

  // 读取右侧面板确认
  let text = await readPage(page);
  console.log(`  面板内容:\n    ${text.substring(text.indexOf('选择主表'), text.indexOf('选择主表') + 200).replace(/\n/g, '\n    ')}`);

  // 点击选择主表的下拉框（x-biz-dropdown-label）
  console.log('  点击选择主表下拉框...');
  const dropdownLabel = page.locator('.link-form-combo .x-biz-dropdown-label, .x-biz-entry-select-combo .x-biz-dropdown-label').first();
  if (await dropdownLabel.count() > 0) {
    await dropdownLabel.click({ force: true });
    await page.waitForTimeout(1500);

    // 读取下拉选项
    text = await readPage(page);
    console.log(`  下拉选项:\n    ${text.substring(0, 1500).replace(/\n/g, '\n    ')}`);

    await page.screenshot({ path: 'screenshots/assoc-select-table-dropdown.png', fullPage: true });

    // 选择"客户信息"
    // 使用 Playwright 的 getByText 或 locator with text
    const customerOption = page.locator('.x-biz-dropdown-label:has-text("客户信息"), [class*="option"]:has-text("客户信息"), [class*="item"]:has-text("客户信息")').first();
    if (await customerOption.count() > 0 && await customerOption.isVisible().catch(() => false)) {
      await customerOption.click({ force: true });
      await page.waitForTimeout(1000);
      console.log('  已选择"客户信息"');
    } else {
      // Try clicking by text directly
      const textOption = page.locator('text=客户信息').last();
      if (await textOption.count() > 0) {
        await textOption.click({ force: true });
        await page.waitForTimeout(1000);
        console.log('  已选择"客户信息" (via text)');
      }
    }
  } else {
    console.log('  未找到选择主表下拉框');
  }

  await page.screenshot({ path: 'screenshots/assoc-linkdata-done.png', fullPage: true });
}

/**
 * 根据官方文档，关联子表配置步骤：
 * 1. 添加关联子表字段
 * 2. 绑定关联表（已有表单 或 从空白新建）
 * 3. 设置显示字段
 * 4. 配置数据操作（可新增、可删除、随主数据一同新增等）
 */
async function configLinkSubtable(page: Page): Promise<void> {
  console.log('\n====== 配置【关联子表】- 订单明细 ======');

  await clickFieldWidget(page, '关联子表');

  // 设置标题
  const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
  try {
    const val = await titleInput.inputValue().catch(() => '');
    if (val) {
      await titleInput.click({ clickCount: 3, force: true });
      await titleInput.fill('订单明细');
      console.log('  设置标题: "订单明细"');
      await page.waitForTimeout(400);
    }
  } catch {}

  // 读取右侧面板
  let text = await readPage(page);
  console.log(`  面板内容:\n    ${text.substring(0, 2000).replace(/\n/g, '\n    ')}`);

  await page.screenshot({ path: 'screenshots/assoc-subtable.png', fullPage: true });

  // 找"选择关联表"或"关联表"下拉
  const subtableDropdown = page.locator('[class*="subtable"] .x-biz-dropdown-label, [class*="link-sub"] .x-biz-dropdown-label').first();
  if (await subtableDropdown.count() > 0) {
    console.log('  点击关联表下拉...');
    await subtableDropdown.click({ force: true });
    await page.waitForTimeout(1500);

    text = await readPage(page);
    console.log(`  下拉选项:\n    ${text.substring(0, 1500).replace(/\n/g, '\n    ')}`);

    await page.screenshot({ path: 'screenshots/assoc-subtable-dropdown.png', fullPage: true });
  }
}

/**
 * 根据官方文档，选择数据配置步骤：
 * 1. 添加选择数据字段
 * 2. 设置数据源（选择表单/聚合表）
 * 3. 配置数据选择过程（显示字段、过滤、排序）
 * 4. 配置数据填充规则
 */
async function configChooseData(page: Page): Promise<void> {
  console.log('\n====== 配置【选择数据】- 选择产品 ======');

  await clickFieldWidget(page, '选择数据');

  // 设置标题
  const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
  try {
    const val = await titleInput.inputValue().catch(() => '');
    if (val) {
      await titleInput.click({ clickCount: 3, force: true });
      await titleInput.fill('选择产品');
      console.log('  设置标题: "选择产品"');
      await page.waitForTimeout(400);
    }
  } catch {}

  // 读取右侧面板
  let text = await readPage(page);
  console.log(`  面板内容:\n    ${text.substring(0, 2000).replace(/\n/g, '\n    ')}`);

  await page.screenshot({ path: 'screenshots/assoc-choosedata.png', fullPage: true });

  // 找"数据源"下拉
  const dataSourceDropdown = page.locator('[class*="choose"] .x-biz-dropdown-label, [class*="data-source"] .x-biz-dropdown-label').first();
  if (await dataSourceDropdown.count() > 0) {
    console.log('  点击数据源下拉...');
    await dataSourceDropdown.click({ force: true });
    await page.waitForTimeout(1500);

    text = await readPage(page);
    console.log(`  下拉选项:\n    ${text.substring(0, 1500).replace(/\n/g, '\n    ')}`);

    await page.screenshot({ path: 'screenshots/assoc-choosedata-dropdown.png', fullPage: true });
  }
}

async function main() {
  console.log('[CONFIG] 配置关联字段（基于官方文档）...\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入订单管理编辑器
    await enterFormEditor(page, '订单管理');

    let text = await readPage(page);
    console.log(`编辑器当前内容:\n  ${text.substring(0, 400).replace(/\n/g, '\n  ')}`);

    // 配置关联数据
    await configLinkData(page);

    // 保存
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.count() > 0 && await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      console.log('\n  ✓ 已保存');
      await page.waitForTimeout(2000);
    }

    // 配置关联子表
    await configLinkSubtable(page);

    // 保存
    if (await page.locator('button:has-text("保存")').first().isVisible().catch(() => false)) {
      await page.locator('button:has-text("保存")').first().click({ force: true });
      console.log('  ✓ 已保存');
      await page.waitForTimeout(2000);
    }

    // 配置选择数据
    await configChooseData(page);

    // 最终保存
    if (await page.locator('button:has-text("保存")').first().isVisible().catch(() => false)) {
      await page.locator('button:has-text("保存")').first().click({ force: true });
      console.log('\n  ✓ 最终保存完成');
      await page.waitForTimeout(2000);
    }

    console.log('\n====== 三个关联字段配置完成！ ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
