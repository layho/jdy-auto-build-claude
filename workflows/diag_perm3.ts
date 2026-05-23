/**
 * 诊断：点击"添加成员"查看权限设置流程
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 权限设置流程...\n');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    const EDIT_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a105e483bb7f8780e826456/edit#/edit';
    await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 点击"表单发布"标签
    console.log('[DIAG] 进入表单发布...');
    await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // 点击"添加成员"
    console.log('[DIAG] 点击"添加成员"...');
    const addMemberBtn = page.locator('button:has-text("添加成员")').first();
    if (await addMemberBtn.count() > 0) {
      await addMemberBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 点击后页面内容:\n${text.substring(0, 2500)}`);

      await page.screenshot({ path: 'screenshots/diag-addmember.png', fullPage: true });

      // 找弹窗/对话框内容
      const dialogText = await page.locator('[class*="dialog"], [class*="modal"], [class*="popup"], [class*="drawer"]').first().innerText().catch(() => '');
      console.log(`\n[DIAG] 弹窗内容:\n${dialogText?.substring(0, 2000)}`);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
