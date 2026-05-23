/**
 * 诊断：在表单编辑器中查找权限设置
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 表单编辑器中的权限设置...\n');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 直接进入表单编辑器
    const EDIT_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a105e483bb7f8780e826456/edit#/edit';
    console.log('[DIAG] 进入表单编辑器...');
    await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 编辑器页面内容:\n${text.substring(0, 2000)}`);

    // 找顶部或侧边的所有按钮/标签
    const topEls = await page.$$eval('[class*="top"] button, [class*="header"] button, [class*="toolbar"] button, [class*="tab"] button, [class*="tab"] span, [class*="tab"] a, [class*="nav"] button, [class*="nav"] a', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        tag: el.tagName,
        text: (el.textContent?.trim() || '').substring(0, 50),
        class: (el as HTMLElement).className?.substring(0, 120),
      }))
    );
    console.log(`[DIAG] 顶部/导航元素:`);
    topEls.forEach(e => console.log(`  <${e.tag}> "${e.text}" class="${e.class}"`));

    // 查找"表单发布"或"发布"按钮
    const publishEls = page.locator('text=发布').first();
    console.log(`[DIAG] "发布" 元素数量: ${await publishEls.count()}`);

    // 查找所有tab
    const tabs = await page.$$eval('[class*="tab"], [class*="setting"], [role="tab"]', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        tag: el.tagName,
        text: (el.textContent?.trim() || '').substring(0, 50),
        class: (el as HTMLElement).className?.substring(0, 150),
        role: (el as HTMLElement).getAttribute('role'),
      }))
    );
    console.log(`[DIAG] Tab/设置元素:`);
    tabs.forEach(t => console.log(`  <${t.tag}> "${t.text}" role=${t.role} class="${t.class}"`));

    await page.screenshot({ path: 'screenshots/diag-perm2-editor.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
