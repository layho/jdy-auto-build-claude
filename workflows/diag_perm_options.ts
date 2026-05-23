/**
 * 诊断：查看权限级别下拉选项
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 查看权限下拉选项...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入客户信息表单编辑器
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1060b33b91be59b687ca54/edit#/edit', {
      waitUntil: 'domcontentloaded',
    });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 表单发布 → 添加成员 → 搜索齐妍娜 → 勾选 → 确定
    await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    await page.locator('button:has-text("添加成员")').first().click({ force: true });
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键字"]').first();
    await searchInput.fill('齐妍娜');
    await page.waitForTimeout(1500);

    // 全选
    await page.locator('text=成员结果全选').first().click({ force: true });
    await page.waitForTimeout(500);

    // 确定
    await page.locator('button:has-text("确定")').last().click({ force: true });
    await page.waitForTimeout(2000);

    // 现在看到权限设置弹窗 - 找下拉框
    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 权限设置弹窗:\n${text.substring(0, 2000)}`);

    // 点击权限下拉 - 找 "添加并管理本人数据" 附近的元素
    const permDropdown = page.locator('[class*="select"]:has-text("添加并管理"), [class*="dropdown"]:has-text("添加并管理"), [class*="picker"]:has-text("添加并管理")').first();
    console.log(`\n[DIAG] 权限下拉 count: ${await permDropdown.count()}`);

    // 或者找 select 元素
    const selectEls = await page.$$eval('select, [class*="selector"], [class*="x-select"]', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        tag: el.tagName,
        text: (el.textContent?.trim() || '').substring(0, 100),
        class: (el as HTMLElement).className?.substring(0, 120),
      }))
    );
    console.log('[DIAG] Select元素:', selectEls);

    // 尝试点击 "添加并管理本人数据" 文本
    const permText = page.locator('text=添加并管理本人数据').first();
    if (await permText.count() > 0 && await permText.isVisible().catch(() => false)) {
      console.log('\n[DIAG] 点击权限文本...');
      await permText.click({ force: true });
      await page.waitForTimeout(1000);

      const afterClick = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 点击后:\n${afterClick.substring(0, 2500)}`);

      await page.screenshot({ path: 'screenshots/diag-perm-options.png', fullPage: true });
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
