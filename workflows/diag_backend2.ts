/**
 * 诊断：应用后台 → 表单/仪表盘权限 → 添加成员
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 后台权限设置流程...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 直接进入应用后台权限页面
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/settings#/app_group', {
      waitUntil: 'domcontentloaded',
    });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 检查是否有"表单/仪表盘权限"菜单，如果有就点击
    const permMenu = page.locator('text=表单/仪表盘权限').last();
    if (await permMenu.count() > 0 && await permMenu.isVisible().catch(() => false)) {
      console.log('[DIAG] 点击"表单/仪表盘权限"...');
      await permMenu.click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    }

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 页面内容:\n${text.substring(0, 2000)}\n`);
    console.log(`[DIAG] URL: ${page.url()}`);

    await page.screenshot({ path: 'screenshots/diag-backend-perm.png', fullPage: true });

    // 勾选表单
    const checkbox = page.locator('[class*="checkbox"], input[type="checkbox"]').first();
    const cbCount = await checkbox.count();
    console.log(`[DIAG] checkbox count: ${cbCount}`);

    if (cbCount > 0) {
      const checked = await checkbox.isChecked().catch(() => null);
      console.log(`[DIAG] checkbox checked: ${checked}`);

      if (!checked) {
        console.log('[DIAG] 勾选表单...');
        await checkbox.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // 点击"添加成员"
    const addMemberBtn = page.locator('button:has-text("添加成员")').last();
    if (await addMemberBtn.count() > 0 && await addMemberBtn.isVisible().catch(() => false)) {
      console.log('[DIAG] 点击"添加成员"...');
      await addMemberBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const dialogText = await page.locator('[class*="dialog"], [class*="modal"], [class*="drawer"], [class*="popup"]').first().innerText().catch(() => '');
      console.log(`[DIAG] 弹窗内容:\n${dialogText?.substring(0, 2000)}`);

      await page.screenshot({ path: 'screenshots/diag-backend-addmember.png', fullPage: true });

      // 读取完整页面内容
      const fullText = await page.locator('body').first().innerText().catch(() => '');
      console.log(`\n[DIAG] 完整页面内容:\n${fullText.substring(0, 3000)}`);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
