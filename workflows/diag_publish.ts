/**
 * 诊断：点击"表单发布"标签页查看权限设置
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 查看表单发布页面...\n');
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
    console.log('[DIAG] 点击"表单发布"标签...');
    const publishTab = page.locator('li.tab-header-item:has-text("表单发布")').first();
    await publishTab.click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 表单发布页面内容:\n${text.substring(0, 2500)}`);

    await page.screenshot({ path: 'screenshots/diag-publish2.png', fullPage: true });

    // 找权限设置相关元素
    const permEls = await page.$$eval('button, a, span, li, div, input, select', els =>
      els.filter(el => {
        const t = el.textContent?.trim() || '';
        return /权限|成员|完全|管理|仅|查看|添加|编辑|删除|发布/.test(t) && t.length < 30;
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        class: (el as HTMLElement).className?.substring(0, 120),
        visible: el.offsetParent !== null,
      }))
    );
    console.log(`\n[DIAG] 权限相关元素:`);
    permEls.forEach(e => console.log(`  <${e.tag}> "${e.text}" visible=${e.visible} class="${e.class}"`));

    // 查找是否有下拉框来修改权限
    const selects = await page.$$eval('select, [class*="select"], [class*="dropdown"], [class*="picker"]', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        tag: el.tagName,
        text: (el.textContent?.trim() || '').substring(0, 100),
        class: (el as HTMLElement).className?.substring(0, 120),
      }))
    );
    console.log(`\n[DIAG] 下拉/选择器:`);
    selects.forEach(s => console.log(`  <${s.tag}> "${s.text}" class="${s.class}"`));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
