/**
 * 练习关联字段。核心原则：
 * 1. 先读懂弹窗内容，再决定操作
 * 2. 已有表单就先清理/编辑，不要盲目新建
 * 3. 建完表单要赋予当前用户完全管理权限
 * 4. 保存前确认表单名是否正确
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login, navigateToApp,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_ID = '6a0aa9d82c4789aa80588d06';
const APP_URL = `https://www.jiandaoyun.com/dashboard#/app/${APP_ID}`;
const SETTINGS_URL = `https://www.jiandaoyun.com/dashboard/app/${APP_ID}/settings#/app_group`;

async function readPage(page: Page): Promise<string> {
  return await page.locator('body').first().innerText().catch(() => '') || '';
}

async function closeAllDialogs(page: Page): Promise<void> {
  for (const text of ['取消', '我知道了']) {
    const btn = page.locator(`button:has-text("${text}")`).last();
    if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.locator('.x-window-mask').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

async function deleteOneForm(page: Page, formName: string): Promise<boolean> {
  console.log(`\n删除表单: "${formName}"`);

  const entry = page.locator('.tree-node').filter({ hasText: formName }).first();
  if (await entry.count() === 0) {
    console.log('  未找到该表单');
    return false;
  }

  await entry.hover({ force: true });
  await page.waitForTimeout(600);
  await entry.locator('.entry-set-icon').click({ force: true });
  await page.waitForTimeout(600);

  await page.locator('li:has-text("删除")').last().click({ force: true });
  await page.waitForTimeout(1000);

  const alertText = await page.locator('[class*="x-alert"]').first().innerText().catch(() => '');
  console.log('  弹窗内容:');
  alertText.split('\n').forEach(line => console.log(`    ${line}`));

  if (alertText.includes('无法删除') || alertText.includes('已被引用') || alertText.includes('被调用')) {
    console.log('  → 表单被引用，无法删除，关闭弹窗');
    await page.locator('button:has-text("我知道了")').last().click({ force: true });
    await page.waitForTimeout(500);
    await closeAllDialogs(page);
    return false;
  }

  if (alertText.includes('确定要删除')) {
    if (alertText.includes('请输入表单名称')) {
      console.log('  → 需要输入表单名称确认');
      const input = page.locator('[class*="alert"] input').first();
      await input.click({ clickCount: 3, force: true });
      await input.fill(formName);
      await page.waitForTimeout(300);
    } else {
      console.log('  → 无需输入名称，直接确认删除');
    }

    const delBtn = page.locator('[class*="alert"] button:has-text("删除")').last();
    if (await delBtn.count() > 0 && await delBtn.isVisible().catch(() => false)) {
      await delBtn.click({ force: true });
      console.log('  → 已确认删除');
      await page.waitForTimeout(2000);
      await closeAllDialogs(page);
      return true;
    }
  }

  console.log('  → 未识别弹窗，尝试关闭');
  await closeAllDialogs(page);
  return false;
}

/**
 * 创建空白表单。处理两种状态：
 * - 空状态：entry-item:has-text("新建表单") 可见
 * - 非空状态：需要先点 add-button，再点"新建表单"
 */
async function createBlankForm(page: Page): Promise<void> {
  console.log('  创建空白表单...');

  // 先读取页面内容，判断状态
  const pageText = await readPage(page);

  // 空状态：有 entry-item 入口
  const newFormEntry = page.locator('.entry-item:has-text("新建表单")').first();
  const newFormCount = await newFormEntry.count();

  if (newFormCount > 0 && await newFormEntry.isVisible().catch(() => false)) {
    console.log('  空状态 → 通过"新建表单"入口创建...');
    await newFormEntry.click({ force: true });
    await page.waitForTimeout(800);

    // 点"创建空白表单"
    const blankBtn = page.locator('.create-item.create-empty').first();
    await blankBtn.waitFor({ state: 'visible', timeout: 5000 });
    await blankBtn.click();
    await page.waitForURL('**/form/*/edit**', { timeout: 15000 });
  } else {
    // 非空状态：点 sidebar 的 add-button (+)，展开菜单
    console.log('  非空状态 → 点 add-button 展开菜单...');
    const addBtn = page.locator('.add-button').first();
    await addBtn.waitFor({ state: 'visible', timeout: 5000 });
    await addBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 读取菜单内容
    const menuText = await readPage(page);
    console.log(`  菜单内容: "${menuText.substring(menuText.indexOf('新建'), menuText.indexOf('新建') + 80)}"`);

    // 点"新建表单"
    const newFormLink = page.locator('text=新建表单').first();
    await newFormLink.waitFor({ state: 'visible', timeout: 5000 });
    await newFormLink.click({ force: true });
    await page.waitForTimeout(1000);

    // 弹窗出现，点"创建空白表单"
    const blankBtn = page.locator('.create-item.create-empty').first();
    await blankBtn.waitFor({ state: 'visible', timeout: 5000 });
    await blankBtn.click();
    await page.waitForURL('**/form/*/edit**', { timeout: 15000 });
  }

  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
  console.log(`  已进入编辑器: ${page.url()}`);
}

/**
 * 在编辑器里重命名表单：点顶部表单名 → 修改
 */
async function renameFormInEditor(page: Page, newName: string): Promise<void> {
  console.log(`  重命名表单为 "${newName}"...`);

  // 读取当前页面，确认表单名
  const text = await readPage(page);

  // 点顶部表单名（可能在导航栏中）
  const formNameInNav = page.locator('.fx-navigation-bar [class*="title"], .fx-form-navigation-bar [class*="name"]').first();
  const nameCount = await formNameInNav.count();

  if (nameCount > 0 && await formNameInNav.isVisible().catch(() => false)) {
    // 双击或点击编辑
    await formNameInNav.click({ force: true });
    await page.waitForTimeout(500);
  }

  // 尝试直接找可编辑的input
  const nameInput = page.locator('.fx-entry-modify-dialog input.input-inner, input[value*="未命名"]').first();
  if (await nameInput.count() > 0 && await nameInput.isVisible().catch(() => false)) {
    await nameInput.click({ clickCount: 3, force: true });
    await nameInput.fill(newName);
    await page.waitForTimeout(300);

    // 确认
    const confirmBtn = page.locator('button:has-text("确定")').last();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(1000);
      console.log(`  ✓ 已重命名为 "${newName}"`);
      return;
    }
  }

  console.log('  → 重命名需要在表单列表中操作，先跳过（保存前处理）');
}

async function addTextField(page: Page, fieldName: string): Promise<void> {
  console.log(`  添加字段: [单行文本] "${fieldName}"`);

  const widget = page.locator('li.form-edit-widget-label:has-text("单行文本")').first();
  await widget.waitFor({ state: 'visible', timeout: 10000 });
  await widget.click({ force: true });
  await page.waitForTimeout(800);

  const nameInput = page.locator('.fx-field-title-input input.input-inner').last();
  try {
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.click({ clickCount: 3, force: true });
    await nameInput.fill(fieldName);
    await page.waitForTimeout(400);
  } catch {
    console.log('    警告: 无法设置字段名');
  }
}

async function addSelectField(page: Page, fieldName: string, options: string[]): Promise<void> {
  console.log(`  添加字段: [下拉框] "${fieldName}"`);

  const widget = page.locator('li.form-edit-widget-label:has-text("下拉框")').first();
  await widget.waitFor({ state: 'visible', timeout: 5000 });
  await widget.click({ force: true });
  await page.waitForTimeout(800);

  const nameInput = page.locator('.fx-field-title-input input.input-inner').last();
  try {
    await nameInput.waitFor({ state: 'visible', timeout: 3000 });
    await nameInput.click({ clickCount: 3, force: true });
    await nameInput.fill(fieldName);
    await page.waitForTimeout(400);
  } catch {}

  const batchBtn = page.locator('button:has-text("批量编辑")').first();
  try {
    await batchBtn.click({ force: true, timeout: 3000 });
    await page.waitForTimeout(800);

    const dialogText = await page.locator('[class*="dialog"]').first().innerText().catch(() => '');
    console.log(`    批量编辑弹窗: "${dialogText?.substring(0, 150)}"`);

    const textarea = page.locator('[class*="multi-edit"] textarea, [class*="dialog"] textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 5000 });
    await textarea.click({ clickCount: 3, force: true });
    await textarea.fill(options.join('\n'));
    await page.waitForTimeout(300);

    await page.locator('[class*="multi-edit"] button:has-text("确定"), [class*="dialog"] button:has-text("确定")').first().click({ force: true });
    await page.waitForTimeout(800);
  } catch {
    console.log('    警告: 批量编辑失败');
  }
}

/**
 * 保存表单，同时确认表单名
 */
async function saveCurrentForm(page: Page, expectedName: string): Promise<void> {
  // 保存前先读取页面，确认表单名
  const text = await readPage(page);
  if (text.includes(expectedName)) {
    console.log(`  ✓ 表单名 "${expectedName}" 已确认`);
  } else {
    console.log(`  ⚠ 当前表单名可能不是 "${expectedName}"，页面内容:`);
    console.log(`    ${text.substring(0, 200)}`);
  }

  const saveBtn = page.locator('button:has-text("保存")').first();
  if (await saveBtn.count() > 0 && await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click({ force: true });
    console.log('  ✓ 已保存');
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
  }
}

/**
 * 在表单编辑器中设置权限：表单发布 → 添加成员
 */
async function setFormPermissionInEditor(page: Page): Promise<void> {
  console.log('  设置表单权限...');

  // 点击"表单发布"标签
  const publishTab = page.locator('li.tab-header-item:has-text("表单发布")').first();
  if (await publishTab.count() === 0 || !(await publishTab.isVisible().catch(() => false))) {
    console.log('  → 未找到"表单发布"标签，跳过权限设置');
    return;
  }

  await publishTab.click({ force: true });
  await page.waitForTimeout(1500);
  await waitForStableDOM(page);

  // 读取发布页内容
  const pubText = await readPage(page);
  console.log(`  发布页内容:\n    ${pubText.substring(0, 500).replace(/\n/g, '\n    ')}`);

  // 找"添加成员"按钮
  const addMemberBtn = page.locator('button:has-text("添加成员")').first();
  if (await addMemberBtn.count() > 0 && await addMemberBtn.isVisible().catch(() => false)) {
    await addMemberBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // 读取弹窗内容
    const dialogText = await page.locator('[class*="dialog"], [class*="modal"], [class*="drawer"]').first().innerText().catch(() => '');
    console.log(`  添加成员弹窗:\n    ${dialogText?.substring(0, 500).replace(/\n/g, '\n    ')}`);

    // TODO: 选择当前用户并设置权限
    // 暂时关闭弹窗
    await page.locator('button:has-text("取消")').last().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

/**
 * 通过应用后台设置表单权限（给当前用户完全管理）
 */
async function setFormPermissionViaBackend(page: Page, formName: string): Promise<void> {
  console.log(`  通过后台设置 "${formName}" 权限...`);

  await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  // 点击"表单/仪表盘权限"菜单
  const permMenu = page.locator('text=表单/仪表盘权限').last();
  if (await permMenu.count() > 0 && await permMenu.isVisible().catch(() => false)) {
    await permMenu.click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);
  }

  const text = await readPage(page);
  console.log(`  权限页内容:\n    ${text.substring(0, 600).replace(/\n/g, '\n    ')}`);

  // TODO: 找到表单的checkbox并勾选, 然后点"添加成员"设置权限
  // 这需要更详细的交互，先跳过
  console.log('  → 权限设置需要进一步调试，暂时跳过');
}

async function main() {
  console.log('[练习] 关联字段 — 创建客户信息 / 产品信息 / 订单管理\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ======== 第1步：进入应用，检查状态 ========
    console.log('======== 第1步：检查应用状态 ========');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`现有表单: ${formNames.join(', ') || '(空)'}`);

    // 如果当前在表单编辑器中，先回到应用首页
    if (page.url().includes('/form/') && page.url().includes('/edit')) {
      console.log('当前在表单编辑器中，先回到应用首页...');
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(3000);
      formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    }

    // ======== 第2步：清理旧表单 ========
    if (formNames.length > 0) {
      console.log(`\n======== 第2步：清理${formNames.length}个旧表单 ========`);
      for (const name of formNames) {
        await deleteOneForm(page, name);
      }

      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
      await waitForStableDOM(page);
      await page.waitForTimeout(3000);
      formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
      console.log(`\n清理后剩余: ${formNames.join(', ') || '(空，已全部清空)'}`);
    }

    // ======== 第3步：创建表单1 - 客户信息 ========
    console.log('\n======== 第3步：创建"客户信息"表单 ========');
    await createBlankForm(page);

    await addTextField(page, '客户名称');
    await addTextField(page, '联系电话');
    await addSelectField(page, '客户等级', ['VIP客户', '普通客户', '潜在客户']);
    await addTextField(page, '地址');

    await saveCurrentForm(page, '客户信息');
    await page.screenshot({ path: 'screenshots/form1-customer.png', fullPage: true });

    // 返回应用首页
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ======== 第4步：创建表单2 - 产品信息 ========
    console.log('\n======== 第4步：创建"产品信息"表单 ========');
    await createBlankForm(page);

    await addTextField(page, '产品名称');
    await addTextField(page, '规格型号');
    await addTextField(page, '单价');
    await addTextField(page, '库存数量');

    await saveCurrentForm(page, '产品信息');
    await page.screenshot({ path: 'screenshots/form2-product.png', fullPage: true });

    // 返回应用首页
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ======== 第5步：创建表单3 - 订单管理（关联字段） ========
    console.log('\n======== 第5步：创建"订单管理"表单（关联字段练习） ========');
    await createBlankForm(page);

    // 基础字段
    await addTextField(page, '订单编号');
    await addTextField(page, '下单日期');

    // 添加关联数据字段 — 关联客户信息
    console.log('\n  >>> 添加【关联数据】字段，关联"客户信息"...');
    const linkDataWidget = page.locator('li.form-edit-widget-label:has-text("关联数据")').first();
    await linkDataWidget.click({ force: true });
    await page.waitForTimeout(2000);

    // 读取弹窗内容
    const linkDataDialog = await page.locator('[class*="dialog"], [class*="drawer"]').first().innerText().catch(() => '');
    console.log('  关联数据配置弹窗:');
    linkDataDialog?.split('\n').forEach(line => console.log(`    ${line}`));

    await page.screenshot({ path: 'screenshots/assoc-linkdata-dialog.png', fullPage: true });

    // TODO: 根据弹窗内容配置关联数据
    // TODO: 添加关联子表字段 — 订单明细
    // TODO: 添加选择数据字段 — 选择产品

    console.log('\n[练习] 基础表单已创建。关联数据弹窗内容已读取，等待继续配置。');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
