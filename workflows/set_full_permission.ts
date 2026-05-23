/**
 * 给齐妍娜设置"管理全部数据"（完全管理）权限
 * 因为齐妍娜已经被添加为成员，需要编辑权限级别
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function setFullPermission(page: any, formName: string): Promise<void> {
  console.log(`\n====== 设置 "${formName}" 权限 ======`);

  // 回到应用首页
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);

  // 进入表单编辑器
  const formEntry = page.locator('.tree-node').filter({ hasText: formName }).first();
  await formEntry.hover({ force: true });
  await page.waitForTimeout(600);
  await formEntry.locator('.entry-set-icon').click({ force: true });
  await page.waitForTimeout(600);
  await page.locator('li:has-text("编辑")').last().click({ force: true });
  await page.waitForURL('**/edit**', { timeout: 10000 });
  await waitForStableDOM(page);
  await page.waitForTimeout(2000);

  // 表单发布
  await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);

  const text = await page.locator('body').first().innerText().catch(() => '');
  console.log(`  发布页内容预览:\n    ${text.substring(0, 600).replace(/\n/g, '\n    ')}`);

  // 查找齐妍娜是否已在成员列表中
  const qinaInList = page.locator('[class*="member"]:has-text("齐妍娜"), [class*="auth"]:has-text("齐妍娜"), [class*="publish"]:has-text("齐妍娜")').first();
  const qinaCount = await qinaInList.count();

  if (qinaCount > 0 && await qinaInList.isVisible().catch(() => false)) {
    // 齐妍娜已在列表中 - 直接修改权限
    console.log('  齐妍娜已在成员列表中，修改权限...');

    // 找权限下拉并点击
    const permSelector = qinaInList.locator('[class*="select"], [class*="dropdown"], [class*="picker"]').first();
    if (await permSelector.count() === 0) {
      // 点"添加并管理本人数据"文本
      const permLabel = page.locator('text=添加并管理本人数据').first();
      if (await permLabel.count() > 0 && await permLabel.isVisible().catch(() => false)) {
        await permLabel.click({ force: true });
        await page.waitForTimeout(800);
      }
    } else {
      await permSelector.click({ force: true });
      await page.waitForTimeout(800);
    }
  } else {
    // 齐妍娜不在列表中 - 需要添加
    console.log('  齐妍娜不在列表中，先添加...');

    await page.locator('button:has-text("添加成员")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // 搜索并选择
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键字"]').first();
    await searchInput.fill('齐妍娜');
    await page.waitForTimeout(1500);

    await page.locator('text=成员结果全选').first().click({ force: true });
    await page.waitForTimeout(500);

    await page.locator('button:has-text("确定")').last().click({ force: true });
    await page.waitForTimeout(2000);

    // 现在应该有权限设置弹窗, 点击默认权限
    const permLabel = page.locator('text=添加并管理本人数据').first();
    if (await permLabel.count() > 0 && await permLabel.isVisible().catch(() => false)) {
      await permLabel.click({ force: true });
      await page.waitForTimeout(800);
    }
  }

  // 选择"管理全部数据"
  const fullPerm = page.locator('text=管理全部数据').last();
  if (await fullPerm.count() > 0 && await fullPerm.isVisible().catch(() => false)) {
    console.log('  选择"管理全部数据"...');
    await fullPerm.click({ force: true });
    await page.waitForTimeout(500);
  } else {
    console.log('  未找到"管理全部数据"选项');
  }

  await page.screenshot({ path: `screenshots/perm-${formName}-final.png`, fullPage: true });

  // 点确定保存
  const confirmBtn = page.locator('button:has-text("确定")').last();
  if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(1500);
    console.log('  ✓ 权限已设置');
  }

  // 关闭可能的弹窗
  await page.locator('button:has-text("取消")').last().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
}

async function main() {
  console.log('[PERM] 设置完全管理权限...\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await setFullPermission(page, '客户信息');
    await setFullPermission(page, '产品信息');
    await setFullPermission(page, '订单管理');

    console.log('\n[PERM] 全部完成！');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
