/**
 * 删除订单管理 + 订单明细表，然后干净重建
 * 最后每个字段正确配置完成后保存
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

async function closeDialogs(page: Page): Promise<void> {
  for (const text of ['取消', '我知道了']) {
    const btn = page.locator(`button:has-text("${text}")`).last();
    if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
}

async function deleteFormByName(page: Page, formName: string): Promise<void> {
  console.log(`\n删除 "${formName}"...`);
  const entry = page.locator('.tree-node').filter({ hasText: formName }).first();
  if (await entry.count() === 0) {
    console.log('  未找到');
    return;
  }

  await entry.hover({ force: true });
  await page.waitForTimeout(600);
  await entry.locator('.entry-set-icon').click({ force: true });
  await page.waitForTimeout(600);

  await page.locator('li:has-text("删除")').last().click({ force: true });
  await page.waitForTimeout(1000);

  const alertText = await page.locator('[class*="x-alert"]').first().innerText().catch(() => '');
  console.log(`  弹窗: ${alertText.replace(/\n/g, ' ').substring(0, 200)}`);

  if (alertText.includes('无法删除') || alertText.includes('被调用')) {
    await page.locator('button:has-text("我知道了")').last().click({ force: true });
    await closeDialogs(page);
    return;
  }

  if (alertText.includes('确定要删除')) {
    if (alertText.includes('请输入表单名称')) {
      const input = page.locator('[class*="alert"] input').first();
      await input.click({ clickCount: 3, force: true });
      await input.fill(formName);
      await page.waitForTimeout(300);
    }

    const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
    if (await delBtn.count() > 0) {
      await delBtn.click({ force: true });
      console.log('  ✓ 已删除');
      await page.waitForTimeout(2000);
      await closeDialogs(page);
    }
  }
}

async function createBlankForm(page: Page): Promise<void> {
  console.log('\n创建空白表单...');
  await page.waitForTimeout(1000);

  // 空状态
  const newFormEntry = page.locator('.entry-item:has-text("新建表单")').first();
  if (await newFormEntry.count() > 0 && await newFormEntry.isVisible().catch(() => false)) {
    await newFormEntry.click({ force: true });
    await page.waitForTimeout(800);
    await page.locator('.create-item.create-empty').first().click();
    await page.waitForURL('**/form/*/edit**', { timeout: 15000 });
  } else {
    // 非空状态
    await page.locator('.add-button').first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('text=新建表单').first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('.create-item.create-empty').first().click();
    await page.waitForURL('**/form/*/edit**', { timeout: 15000 });
  }

  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
  console.log(`  已进入编辑器: ${page.url()}`);
}

async function addField(page: Page, fieldType: string, fieldName: string): Promise<void> {
  console.log(`  添加 [${fieldType}] "${fieldName}"`);
  const widget = page.locator(`li.form-edit-widget-label:has-text("${fieldType}")`).first();
  await widget.waitFor({ state: 'visible', timeout: 10000 });
  await widget.click({ force: true });
  await page.waitForTimeout(800);

  const input = page.locator('.fx-field-title-input input.input-inner').last();
  try {
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.click({ clickCount: 3, force: true });
    await input.fill(fieldName);
    await page.waitForTimeout(400);
  } catch {}
}

async function saveForm(page: Page): Promise<void> {
  await page.locator('button:has-text("保存")').first().click({ force: true });
  console.log('  ✓ 已保存');
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
}

async function main() {
  console.log('[CLEAN+RECREATE] 删除旧表单，重建订单管理\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入应用 ======
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`现有表单: ${formNames.join(', ')}`);

    // ====== 2. 删除订单管理 + 订单明细表 ======
    await deleteFormByName(page, '订单管理');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await deleteFormByName(page, '订单明细表');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n清理后表单: ${formNames.join(', ')}`);

    // ====== 3. 创建订单管理表单 ======
    console.log('\n====== 创建订单管理表单 ======');
    await createBlankForm(page);

    // 基础字段
    await addField(page, '单行文本', '订单编号');
    await addField(page, '日期时间', '下单日期');

    // 关联数据 → 关联客户信息
    console.log('\n  配置【关联数据 - 关联客户】');
    await addField(page, '关联数据', '关联客户');

    // 选择主表
    const linkDropdown = page.locator('.link-form-combo .x-biz-dropdown-label').first();
    await linkDropdown.click({ force: true });
    await page.waitForTimeout(1000);

    const customerOpt = page.locator('[class*="option"]:has-text("客户信息")').first();
    if (await customerOpt.count() > 0) {
      await customerOpt.click({ force: true });
      console.log('    ✓ 选择主表: 客户信息');
      await page.waitForTimeout(500);
    }

    // 关联子表 → 从空白新建订单明细
    console.log('\n  配置【关联子表 - 订单明细】');
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 设定标题
    const subTitleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await subTitleInput.click({ clickCount: 3, force: true });
    await subTitleInput.fill('订单明细');
    await page.waitForTimeout(400);

    // 点"从空白新建"
    const createBlankBtn = page.locator('text=从空白新建').first();
    if (await createBlankBtn.count() > 0 && await createBlankBtn.isVisible().catch(() => false)) {
      await createBlankBtn.click({ force: true });
      await page.waitForTimeout(1000);

      // 输入关联表名
      const formNameInput = page.locator('[class*="dialog"] input.input-inner').first();
      await formNameInput.click({ clickCount: 3, force: true });
      await formNameInput.fill('订单明细表');
      await page.waitForTimeout(300);

      // 点"设计关联表"
      const designBtn = page.locator('button:has-text("设计关联表")').first();
      if (await designBtn.count() > 0) {
        await designBtn.click({ force: true });
        console.log('    ✓ 创建关联表: 订单明细表');
        await page.waitForTimeout(3000);
      }
    }

    // 选择数据 → 选择产品
    console.log('\n  配置【选择数据 - 选择产品】');
    // 先关闭任何残留弹窗
    await closeDialogs(page);
    await page.waitForTimeout(500);

    await page.locator('li.form-edit-widget-label:has-text("选择数据")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 设标题
    const chooseTitleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await chooseTitleInput.click({ clickCount: 3, force: true });
    await chooseTitleInput.fill('选择产品');
    await page.waitForTimeout(400);

    // 找数据源下拉并选择
    let text = await readPage(page);

    // 查找数据源标签附近的下拉
    const dataSourceDropdown = page.locator('[class*="choose-data"] .x-biz-dropdown-label, [class*="data-source"] .x-biz-dropdown-label').first();
    if (await dataSourceDropdown.count() > 0) {
      await dataSourceDropdown.click({ force: true });
      await page.waitForTimeout(1000);

      const productOpt = page.locator('[class*="option"]:has-text("产品信息")').first();
      if (await productOpt.count() > 0) {
        await productOpt.click({ force: true });
        console.log('    ✓ 数据源: 产品信息');
      }
    } else {
      console.log('    ⚠ 未找到数据源下拉，检查面板...');
      console.log(`    面板内容片段: ${text.substring(text.indexOf('标题'), text.indexOf('标题') + 300)}`);
    }

    // 最终保存
    await saveForm(page);
    await page.screenshot({ path: 'screenshots/final-clean.png', fullPage: true });

    // 验证
    text = await readPage(page);
    const checks = ['订单编号', '下单日期', '关联客户', '客户信息', '订单明细', '选择产品', '产品信息'];
    console.log('\n====== 最终验证 ======');
    checks.forEach(kw => {
      console.log(`  ${text.includes(kw) ? '✓' : '✗'} ${kw}`);
    });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
