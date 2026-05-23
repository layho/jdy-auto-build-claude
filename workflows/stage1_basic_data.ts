/**
 * Stage 1: Build 基础资料模块 - 商品资料, 客户资料, 供应商资料
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06';

interface FieldDef {
  name: string;
  type: string; // '单行文本'|'多行文本'|'数字'|'日期时间'|'下拉框'|'单选按钮组'|'手机'|'地址'|'成员单选'
  options?: string[];
  required?: boolean;
  note?: string;
}

async function addField(page: any, field: FieldDef) {
  // Click the field type in the left sidebar
  const typeEl = page.locator(`:text-is("${field.type}")`).first();
  if (await typeEl.count() === 0) return false;

  // Check if the field type is in a collapsed section
  if (!(await typeEl.isVisible({ timeout: 500 }).catch(() => false))) {
    // Try expanding sections - click 高级 or other collapsed groups
    const collapsedGroups = page.locator('[class*="collapsed"], [class*="group"]:has([class*="arrow"])');
    const groupCount = await collapsedGroups.count();
    for (let i = 0; i < groupCount; i++) {
      const group = collapsedGroups.nth(i);
      if (await group.isVisible({ timeout: 200 }).catch(() => false)) {
        await group.click({ force: true });
        await page.waitForTimeout(300);
      }
    }
  }

  await typeEl.click({ force: true });
  await page.waitForTimeout(800);
  return true;
}

async function configureFieldProps(page: any, field: FieldDef) {
  // After adding a field, the right panel shows field properties
  // The field is selected by default after adding

  // Set field title/name
  const titleInput = page.locator('[class*="field-config"] input, [class*="property"] input').first();
  if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await titleInput.fill(field.name);
    await page.waitForTimeout(300);
  }

  // For dropdown fields, set options
  if (field.type === '下拉框' && field.options) {
    const optionsBtn = page.locator(':text-is("选项"), [class*="option"]').first();
    if (await optionsBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await optionsBtn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
}

async function createForm(page: any, formName: string, fields: FieldDef[]) {
  console.log(`\n[WORKFLOW] Creating form: ${formName}`);

  // Navigate to app and open add menu
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  // Click add button
  await page.evaluate(() => {
    const btn = document.querySelector('button.add-button') as HTMLButtonElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  // Click 新建表单
  await page.locator('.x-menu-item:has-text("新建表单")').first().click({ force: true });
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);

  // Check for "创建空白表单" dialog
  let bodyText = await page.locator('body').first().innerText().catch(() => '');
  if (bodyText.includes('创建空白表单')) {
    await page.locator(':text-is("创建空白表单")').first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);
  }

  // Rename form
  const titleArea = page.locator('[class*="title"]').first();
  if (await titleArea.count() > 0) {
    await titleArea.click({ force: true });
    await page.waitForTimeout(500);
  }
  const nameInput = page.locator('input').first();
  if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
    await nameInput.fill(formName);
    await page.keyboard.press('Enter');
    console.log(`  [SAVE] Named: ${formName}`);
    await page.waitForTimeout(1000);
  }

  // Get form ID from URL
  const formIdMatch = page.url().match(/form\/([a-f0-9]+)\/edit/);
  const formId = formIdMatch ? formIdMatch[1] : 'unknown';
  console.log(`  Form ID: ${formId}`);

  // Add fields
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    console.log(`  [SELECTOR] Adding field: ${field.name} (${field.type})`);

    let retries = 0;
    let added = false;
    while (retries < 3 && !added) {
      added = await addField(page, field);
      if (!added) {
        retries++;
        console.log(`    [RECOVERY] Retry ${retries} for ${field.name}`);
        await page.waitForTimeout(500);
      }
    }

    if (added) {
      await configureFieldProps(page, field);
    } else {
      console.log(`    [ERROR] Failed to add field: ${field.name}`);
    }
  }

  // Save form
  console.log(`  [SAVE] Saving form...`);
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
        (btn as HTMLButtonElement).click();
      }
    }
  });
  await page.waitForTimeout(3000);
  await waitForStableDOM(page);

  // Validate
  bodyText = await page.locator('body').first().innerText().catch(() => '');
  const hasFields = fields.every(f => bodyText.includes(f.name));
  console.log(`  [VALIDATION] All fields present: ${hasFields}`);

  await page.screenshot({ path: `screenshots/stage1-${formName}.png`, fullPage: true });
  return formId;
}

async function main() {
  console.log('[STAGE 1] 基础资料模块\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== Rename app ======
    console.log('[WORKFLOW] Renaming app...');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    await page.locator(':text("应用后台")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
    await page.locator('.x-navigation-item:has-text("应用设置")').last().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // Click "修改" next to app name
    await page.locator('button:has-text("修改"), :text-is("修改")').first().click({ force: true });
    await page.waitForTimeout(800);
    const appNameInput = page.locator('input').first();
    if (await appNameInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await appNameInput.fill('进销存系统（训练版）');
      await page.keyboard.press('Enter');
      console.log('[SAVE] App renamed');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/stage1-app-renamed.png', fullPage: true });

    // ====== Create 商品资料 form ======
    const productFields: FieldDef[] = [
      { name: '商品编码', type: '单行文本' },
      { name: '商品名称', type: '单行文本' },
      { name: '商品分类', type: '下拉框', options: ['手机', '笔记本', '家电'] },
      { name: '品牌', type: '单行文本' },
      { name: '规格型号', type: '单行文本' },
      { name: '单位', type: '下拉框', options: ['件', '箱', '个'] },
      { name: '采购价', type: '数字' },
      { name: '销售价', type: '数字' },
      { name: '安全库存', type: '数字' },
      { name: '状态', type: '单选按钮组', options: ['启用', '停用'] },
      { name: '备注', type: '多行文本' },
    ];
    const productFormId = await createForm(page, '商品资料', productFields);

    // ====== Create 客户资料 form ======
    const customerFields: FieldDef[] = [
      { name: '客户编号', type: '单行文本' },
      { name: '客户名称', type: '单行文本' },
      { name: '联系人', type: '单行文本' },
      { name: '联系电话', type: '手机' },
      { name: '地址', type: '地址' },
      { name: '客户等级', type: '下拉框', options: ['VIP', 'A级', 'B级', 'C级'] },
      { name: '信用额度', type: '数字' },
      { name: '状态', type: '单选按钮组', options: ['启用', '停用'] },
      { name: '备注', type: '多行文本' },
    ];
    const customerFormId = await createForm(page, '客户资料', customerFields);

    // ====== Create 供应商资料 form ======
    const supplierFields: FieldDef[] = [
      { name: '供应商编号', type: '单行文本' },
      { name: '供应商名称', type: '单行文本' },
      { name: '联系人', type: '单行文本' },
      { name: '联系电话', type: '手机' },
      { name: '地址', type: '地址' },
      { name: '结算方式', type: '下拉框', options: ['月结30天', '月结60天', '现结'] },
      { name: '状态', type: '单选按钮组', options: ['启用', '停用'] },
      { name: '备注', type: '多行文本' },
    ];
    const supplierFormId = await createForm(page, '供应商资料', supplierFields);

    console.log('\n[WORKFLOW] Stage 1 complete!');
    console.log(`  Product form ID: ${productFormId}`);
    console.log(`  Customer form ID: ${customerFormId}`);
    console.log(`  Supplier form ID: ${supplierFormId}`);

    await page.screenshot({ path: 'screenshots/stage1-complete.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
