/**
 * 配置订单管理表单的三个关联字段（完整版，不重复开关浏览器）
 *
 * 官方文档：
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

async function setFieldTitle(page: Page, title: string): Promise<void> {
  const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
  try {
    const val = await titleInput.inputValue().catch(() => '');
    if (val) {
      await titleInput.click({ clickCount: 3, force: true });
      await titleInput.fill(title);
      console.log(`  标题设为: "${title}"`);
      await page.waitForTimeout(400);
    }
  } catch {}
}

/**
 * 1. 配置关联数据 - 关联客户信息
 * 步骤：添加字段 → 设标题 → 选择主表（客户信息）
 */
async function configLinkData(page: Page): Promise<void> {
  console.log('\n====== 步骤1: 配置【关联数据】 ======');

  await clickFieldWidget(page, '关联数据');
  await setFieldTitle(page, '关联客户');

  // 点击选择主表下拉（x-biz-dropdown-label）
  const dropdown = page.locator('.link-form-combo .x-biz-dropdown-label').first();
  if (await dropdown.count() > 0) {
    await dropdown.click({ force: true });
    await page.waitForTimeout(1000);

    // 选"客户信息"
    const option = page.locator('[class*="option"]:has-text("客户信息"), [class*="item"]:has-text("客户信息")').first();
    if (await option.count() > 0 && await option.isVisible().catch(() => false)) {
      await option.click({ force: true });
      console.log('  ✓ 关联主表: 客户信息');
      await page.waitForTimeout(500);
    }
  }
}

/**
 * 2. 配置关联子表 - 订单明细
 * 步骤：添加字段 → 设标题 → 从空白新建关联表 → 设计关联表
 */
async function configLinkSubtable(page: Page): Promise<void> {
  console.log('\n====== 步骤2: 配置【关联子表】 ======');

  await clickFieldWidget(page, '关联子表');
  await setFieldTitle(page, '订单明细');

  // 读取面板确认
  let text = await readPage(page);
  console.log(`  面板关键内容: "${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 300).replace(/\n/g, ' ')}"`);

  // 检查是否有"从空白新建"按钮
  const createBlank = page.locator('text=从空白新建').first();
  if (await createBlank.count() > 0 && await createBlank.isVisible().catch(() => false)) {
    console.log('  点击"从空白新建"...');
    await createBlank.click({ force: true });
    await page.waitForTimeout(1000);

    // 可能出现输入框让输入关联表名
    text = await readPage(page);
    console.log(`  弹窗内容: "${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 300).replace(/\n/g, ' ')}"`);

    // 找输入框输入名称
    const nameInput = page.locator('[class*="dialog"] input.input-inner, [class*="modal"] input.input-inner').first();
    if (await nameInput.count() > 0 && await nameInput.isVisible().catch(() => false)) {
      await nameInput.click({ clickCount: 3, force: true });
      await nameInput.fill('订单明细表');
      console.log('  输入关联表名: 订单明细表');
      await page.waitForTimeout(300);
    }

    // 点确定
    const confirmBtn = page.locator('button:has-text("确定")').last();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(1500);
      console.log('  ✓ 关联子表创建完成');
    }
  } else {
    // 尝试"选择表单"方式的绑定已有表单
    console.log('  尝试绑定已有表单...');
    const selectForm = page.locator('text=选择表单').first();
    if (await selectForm.count() > 0 && await selectForm.isVisible().catch(() => false)) {
      await selectForm.click({ force: true });
      await page.waitForTimeout(1000);

      text = await readPage(page);
      console.log(`  选择表单弹窗: "${text.substring(0, 1000).replace(/\n/g, ' ')}"`);
    }
  }

  // 关闭任何残留弹窗
  await page.locator('button:has-text("取消")').last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
}

/**
 * 3. 配置选择数据 - 选择产品
 * 步骤：先点已添加的选择数据字段选中它 → 设标题 → 选数据源 → 配置显示字段
 */
async function configChooseData(page: Page): Promise<void> {
  console.log('\n====== 步骤3: 配置【选择数据】 ======');

  // 先点表单画布上的"选择数据"字段来选中它（如果存在的话）
  // 通过点击字段回收站上方的字段
  const existingField = page.locator('[class*="field-item"]:has-text("选择产品")').first();
  if (await existingField.count() > 0) {
    await existingField.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // 读取面板确认
  let text = await readPage(page);
  console.log(`  属性面板:\n    ${text.substring(text.indexOf('标题'), text.indexOf('标题') + 500).replace(/\n/g, '\n    ')}`);

  // 寻找数据源下拉
  // 选择数据字段的属性面板 class 可能不同
  const dataSourceDropdowns = page.locator('[class*="biz-dropdown-label"], .x-biz-dropdown-label');
  const dsdCount = await dataSourceDropdowns.count();
  console.log(`  页面中下拉组件数: ${dsdCount}`);

  // 尝试找到"数据源"相关下拉
  // 先找数据源 label
  const dataSourceLabel = page.locator('text=数据源').first();
  if (await dataSourceLabel.count() > 0) {
    console.log('  找到"数据源"标签...');
    // 数据源的下拉在 config-content 中
    const dataSourceSection = page.locator('[class*="choose"] .x-biz-dropdown-label').first();
    if (await dataSourceSection.count() > 0) {
      await dataSourceSection.click({ force: true });
    } else {
      // 找数据源label所在区域的下拉
      await dataSourceLabel.click({ force: true });
    }
    await page.waitForTimeout(1000);

    text = await readPage(page);
    console.log(`  数据源下拉选项:\n    ${text.substring(0, 1500).replace(/\n/g, '\n    ')}`);

    // 选择"产品信息"
    const productOption = page.locator('[class*="option"]:has-text("产品信息"), [class*="item"]:has-text("产品信息")').first();
    if (await productOption.count() > 0 && await productOption.isVisible().catch(() => false)) {
      await productOption.click({ force: true });
      console.log('  ✓ 数据源: 产品信息');
      await page.waitForTimeout(500);
    }
  } else {
    console.log('  未找到"数据源"标签，可能字段没有被正确选中');
    // 尝试点画布上的字段来选中
    // 遍历表单画布中所有字段
    const fields = page.locator('[class*="field-item"], [class*="form-field"]');
    const fieldCount = await fields.count();
    console.log(`  表单画布中字段数: ${fieldCount}`);
    for (let i = 0; i < fieldCount; i++) {
      const fieldText = await fields.nth(i).innerText().catch(() => '');
      console.log(`    [${i}]: "${fieldText?.substring(0, 40)}"`);
    }
  }
}

async function saveForm(page: Page): Promise<void> {
  const saveBtn = page.locator('button:has-text("保存")').first();
  if (await saveBtn.count() > 0 && await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click({ force: true });
    console.log('  ✓ 已保存');
    await page.waitForTimeout(2000);
  }
}

async function main() {
  console.log('[CONFIG V2] 配置三个关联字段（完整流程）\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入订单管理编辑器
    await enterFormEditor(page, '订单管理');

    let text = await readPage(page);
    console.log(`当前字段: ${text.match(/关联客户|订单明细|选择产品|订单编号|下单日期/g)?.join(', ') || '基础字段'}`);

    // 步骤1: 关联数据
    await configLinkData(page);
    await saveForm(page);

    // 步骤2: 关联子表
    await configLinkSubtable(page);
    await saveForm(page);

    // 步骤3: 选择数据
    await configChooseData(page);
    await saveForm(page);

    // 最终截图
    await page.screenshot({ path: 'screenshots/final-order-form.png', fullPage: true });
    console.log('\n====== 全部配置完成！ ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
