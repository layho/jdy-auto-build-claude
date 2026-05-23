/**
 * 给当前用户(齐妍娜)设置表单的完全管理权限
 * 流程：表单发布 → 添加成员 → 搜索"齐妍娜" → 勾选 → 确定 → 设置权限级别
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function readPage(page: any) {
  return await page.locator('body').first().innerText().catch(() => '') || '';
}

async function setPermissionForForm(page: any, formName: string): Promise<void> {
  console.log(`\n设置 "${formName}" 权限...`);

  // 进入表单编辑页
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);

  // 找到表单并进入编辑器
  const formEntry = page.locator('.tree-node').filter({ hasText: formName }).first();
  if (await formEntry.count() === 0) {
    console.log(`  未找到表单 "${formName}"`);
    return;
  }

  await formEntry.hover({ force: true });
  await page.waitForTimeout(600);
  await formEntry.locator('.entry-set-icon').click({ force: true });
  await page.waitForTimeout(600);

  await page.locator('li:has-text("编辑")').last().click({ force: true });
  await page.waitForURL('**/edit**', { timeout: 10000 });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  // 点击"表单发布"标签
  console.log('  进入表单发布...');
  await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);

  // 读取发布页内容
  const pubText = await readPage(page);
  console.log(`  发布页: "${pubText.substring(0, 400).replace(/\n/g, ' ')}"`);

  // 点击"添加成员"
  console.log('  点击"添加成员"...');
  await page.locator('button:has-text("添加成员")').first().click({ force: true });
  await page.waitForTimeout(2000);

  // 搜索"齐妍娜"
  const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键字"]').first();
  if (await searchInput.count() > 0 && await searchInput.isVisible().catch(() => false)) {
    await searchInput.click({ force: true });
    await searchInput.fill('齐妍娜');
    await page.waitForTimeout(1500);
  }

  // 读取搜索结果
  const searchText = await readPage(page);
  console.log(`  搜索结果: "${searchText.substring(searchText.indexOf('成员'), searchText.indexOf('成员') + 200).replace(/\n/g, ' ')}"`);

  // 勾选"齐妍娜"
  const qinaCheckbox = page.locator('.tree-node').filter({ hasText: '齐妍娜' }).first();
  if (await qinaCheckbox.count() > 0) {
    console.log('  找到齐妍娜，勾选...');
    // 点击checkbox
    const cb = qinaCheckbox.locator('.node-checkbox, .x-check, input[type="checkbox"]').first();
    if (await cb.count() > 0) {
      await cb.click({ force: true });
    } else {
      // 直接点整个节点
      await qinaCheckbox.click({ force: true });
    }
    await page.waitForTimeout(500);
  } else {
    console.log('  未找到齐妍娜的checkbox节点');

    // 尝试点击 "成员结果全选"
    const selectAll = page.locator('text=成员结果全选').first();
    if (await selectAll.count() > 0 && await selectAll.isVisible().catch(() => false)) {
      console.log('  使用"成员结果全选"...');
      await selectAll.click({ force: true });
      await page.waitForTimeout(500);
    }
  }

  await page.screenshot({ path: `screenshots/perm-${formName}.png`, fullPage: true });

  // 点击"确定"
  console.log('  点击"确定"...');
  const confirmBtn = page.locator('button:has-text("确定")').last();
  if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // 检查确定后的页面，可能弹出权限级别选择
    const afterText = await readPage(page);
    console.log(`  确定后: "${afterText.substring(0, 600).replace(/\n/g, ' ')}"`);
    await page.screenshot({ path: `screenshots/perm-${formName}-after.png`, fullPage: true });
  }
}

async function main() {
  console.log('[PERM] 设置表单权限...\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 给每个表单设置权限
    await setPermissionForForm(page, '客户信息');
    await setPermissionForForm(page, '产品信息');
    await setPermissionForForm(page, '订单管理');

    console.log('\n[PERM] 完成！');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
