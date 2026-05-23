/**
 * 通过编辑器顶部的"表单发布"tab设置权限
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

async function goHome(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2500);
}

async function enterEditor(page: Page, formName: string): Promise<boolean> {
  await goHome(page);
  const entry = page.locator('.tree-node').filter({ hasText: formName }).first();
  if (await entry.count() === 0) return false;

  await entry.hover({ force: true });
  await page.waitForTimeout(600);
  await entry.locator('.entry-set-icon').click({ force: true });
  await page.waitForTimeout(600);
  await page.locator('li:has-text("编辑")').last().click({ force: true });
  await page.waitForURL('**/edit**', { timeout: 10000 });
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);
  return true;
}

async function setPermission(page: Page, formName: string): Promise<void> {
  console.log(`\n====== ${formName} ======`);

  const ok = await enterEditor(page, formName);
  if (!ok) {
    console.log('  无法进入编辑器');
    return;
  }

  // 点击"表单发布"tab
  const publishTab = page.locator('.tab-header-item:has-text("表单发布")').first();
  if (await publishTab.count() === 0) {
    console.log('  未找到表单发布tab');
    return;
  }

  await publishTab.click({ force: true });
  await page.waitForTimeout(3000);
  await waitForStableDOM(page);

  let text = await readPage(page);
  console.log(`  表单发布页面:\n  ${text.substring(0, 500).replace(/\n/g, '\n  ')}`);

  // 检查是否已有齐妍娜
  if (text.includes('齐妍娜')) {
    const hasFullPerm = text.includes('管理全部数据');
    console.log(`  齐妍娜权限: ${hasFullPerm ? '管理全部数据 ✓' : '需要提升'}`);

    if (!hasFullPerm) {
      // 找齐妍娜行的权限下拉
      const rows = page.locator('tr, [class*="member-row"], [class*="perm-row"]');
      const rowCount = await rows.count();
      console.log(`  行数: ${rowCount}`);

      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const rowText = await row.innerText().catch(() => '');
        if (rowText.includes('齐妍娜')) {
          console.log(`  找到齐妍娜行 [${i}]: "${rowText.substring(0, 80)}"`);

          // 找该行的权限下拉
          const dropdown = row.locator('.x-biz-dropdown-label, [class*="dropdown"]').first();
          if (await dropdown.count() > 0) {
            await dropdown.click({ force: true });
            await page.waitForTimeout(1000);

            // 选管理全部数据
            const manageAll = page.locator('[class*="option"]:has-text("管理全部数据"), li:has-text("管理全部数据")').first();
            if (await manageAll.count() > 0 && await manageAll.isVisible().catch(() => false)) {
              await manageAll.click({ force: true });
              console.log('  ✓ 已选择管理全部数据');
              await page.waitForTimeout(500);
            }
          }
          break;
        }
      }
    }
  } else {
    console.log('  需要添加齐妍娜');

    // 找添加成员按钮
    const addBtn = page.locator('button:has-text("添加成员"), span:has-text("添加成员"), button:has-text("添加")').first();
    if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
      await addBtn.click({ force: true });
      await page.waitForTimeout(2000);

      text = await readPage(page);
      console.log(`  添加成员弹窗:\n  ${text.substring(0, 500).replace(/\n/g, '\n  ')}`);

      // 搜索齐妍娜
      const searchInput = page.locator('input[placeholder*="搜索"], [class*="dialog"] input.input-inner').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('齐妍娜');
        await page.waitForTimeout(2000);

        // 选择第一个checkbox
        const checkbox = page.locator('input[type="checkbox"], [class*="checkbox"]').first();
        if (await checkbox.count() > 0) {
          await checkbox.click({ force: true });
          await page.waitForTimeout(500);
        }
      }

      // 点确定
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click({ force: true });
        console.log('  ✓ 已添加成员');
        await page.waitForTimeout(1500);
      }

      // 现在设置权限级别
      text = await readPage(page);
      if (text.includes('齐妍娜')) {
        const rows = page.locator('tr, [class*="member-row"]');
        const rowCount = await rows.count();
        for (let i = 0; i < rowCount; i++) {
          const row = rows.nth(i);
          const rowText = await row.innerText().catch(() => '');
          if (rowText.includes('齐妍娜')) {
            const dropdown = row.locator('.x-biz-dropdown-label').first();
            if (await dropdown.count() > 0) {
              await dropdown.click({ force: true });
              await page.waitForTimeout(1000);

              const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
              if (await manageAll.count() > 0 && await manageAll.isVisible().catch(() => false)) {
                await manageAll.click({ force: true });
                console.log('  ✓ 权限已设置为管理全部数据');
                await page.waitForTimeout(500);
              }
            }
            break;
          }
        }

        // 保存权限
        const saveBtn = page.locator('button:has-text("确定"), button:has-text("保存")').last();
        if (await saveBtn.count() > 0) {
          await saveBtn.click({ force: true });
          console.log('  ✓ 权限已保存');
          await page.waitForTimeout(1500);
        }
      }
    }
  }
}

async function main() {
  console.log('[SET PERMISSIONS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 对每个表单设置权限
    for (const formName of ['客户信息', '产品信息', '订单管理', '订单明细表']) {
      await setPermission(page, formName);
    }

    // 回到首页
    await goHome(page);
    const formNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n====== 表单列表 ======`);
    console.log(formNames.join(' | '));

    // 验证权限
    console.log('\n====== 验证权限状态 ======');
    for (const formName of formNames) {
      await enterEditor(page, formName).catch(() => {});
      if (page.url().includes('edit')) {
        const publishTab = page.locator('.tab-header-item:has-text("表单发布")').first();
        if (await publishTab.count() > 0) {
          await publishTab.click({ force: true });
          await page.waitForTimeout(2000);
          await waitForStableDOM(page);

          const text = await readPage(page);
          const hasQina = text.includes('齐妍娜');
          const hasFull = text.includes('管理全部数据');
          console.log(`  ${formName}: 齐妍娜=${hasQina} 管理全部数据=${hasFull}`);
        }
      }
    }

    console.log('\n====== 权限设置完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
