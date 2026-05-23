/**
 * 诊断：完整权限设置流程
 * 表单发布 → 添加成员 → 选人 → 设置权限
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[DIAG] 完整权限设置流程...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入表单的数据页面（而非编辑器），因为这里能看到"仅添加数据"
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 1. 先进入表单编辑器
    console.log('[DIAG] 步骤1: Hover "客户信息" → 编辑...');
    const formEntry = page.locator('.tree-node').filter({ hasText: '客户信息' }).first();
    await formEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await formEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);

    // 点"编辑"进入编辑器
    const editItem = page.locator('li:has-text("编辑")').last();
    if (await editItem.count() > 0) {
      await editItem.click({ force: true });
      await page.waitForURL('**/edit**', { timeout: 10000 });
    }
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    console.log(`[DIAG] 当前URL: ${page.url()}`);

    // 2. 点击"表单发布"
    console.log('[DIAG] 步骤2: 点击"表单发布"...');
    await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 表单发布页面:\n${text.substring(0, 2000)}`);
    await page.screenshot({ path: 'screenshots/diag-publish-full.png', fullPage: true });

    // 3. 点击"添加成员"
    console.log('\n[DIAG] 步骤3: 点击"添加成员"...');
    const addMemberBtn = page.locator('button:has-text("添加成员")').first();
    if (await addMemberBtn.count() > 0) {
      await addMemberBtn.click({ force: true });
      await page.waitForTimeout(2000);

      text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 添加成员弹窗:\n${text.substring(0, 3000)}`);
      await page.screenshot({ path: 'screenshots/diag-addmember-full.png', fullPage: true });

      // 4. 尝试展开组织架构找到当前用户
      // 先点"成员" tab
      console.log('\n[DIAG] 步骤4: 切换到"成员"tab...');
      const memberTab = page.locator('[class*="tab"]:has-text("成员"), li:has-text("成员")').first();
      if (await memberTab.count() > 0 && await memberTab.isVisible().catch(() => false)) {
        await memberTab.click({ force: true });
        await page.waitForTimeout(1000);

        text = await page.locator('body').first().innerText().catch(() => '');
        console.log(`[DIAG] 成员tab内容:\n${text.substring(0, 2000)}`);
      }

      // 找"齐"
      const qiEl = page.locator('text=齐').first();
      console.log(`[DIAG] "齐" 匹配数: ${await qiEl.count()}`);

      // 关闭弹窗
      await page.locator('button:has-text("取消")').last().click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
