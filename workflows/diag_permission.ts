/**
 * 诊断：找到权限设置入口
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[DIAG] 查找权限设置...\n');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 先进入表单编辑器 - 点击表单
    console.log('[DIAG] 进入"未命名表单"...');
    const formEntry = page.locator('.tree-node').filter({ hasText: '未命名表单' }).first();
    await formEntry.click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    console.log(`[DIAG] URL: ${page.url()}`);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 页面内容:\n${text.substring(0, 1500)}`);

    // 找权限相关的按钮
    const permEls = await page.$$eval('button, a, span, li', els =>
      els.filter(el => {
        const t = el.textContent?.trim() || '';
        return /权限|成员|发布|管理/.test(t) && t.length < 20;
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        class: (el as HTMLElement).className?.substring(0, 120),
        visible: el.offsetParent !== null,
      }))
    );
    console.log(`[DIAG] 权限/成员相关元素:`);
    permEls.forEach(e => console.log(`  <${e.tag}> "${e.text}" visible=${e.visible} class="${e.class}"`));

    await page.screenshot({ path: 'screenshots/diag-perm.png', fullPage: true });

    // 点击"表单发布"看看
    const publishLink = page.locator('text=表单发布').first();
    if (await publishLink.count() > 0 && await publishLink.isVisible().catch(() => false)) {
      console.log('\n[DIAG] 点击"表单发布"...');
      await publishLink.click({ force: true });
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);

      const pubText = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 表单发布页面内容:\n${pubText.substring(0, 1500)}`);

      // 找权限设置按钮
      const permBtns = await page.$$eval('button, a, span, li, div', els =>
        els.filter(el => {
          const t = el.textContent?.trim() || '';
          return /权限|添加成员|完全|管理|查看|编辑|仅/.test(t) && t.length < 30;
        }).map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim(),
          class: (el as HTMLElement).className?.substring(0, 120),
          visible: el.offsetParent !== null,
        }))
      );
      console.log(`[DIAG] 发布页权限相关:`);
      permBtns.forEach(e => console.log(`  <${e.tag}> "${e.text}" visible=${e.visible}`));

      await page.screenshot({ path: 'screenshots/diag-publish.png', fullPage: true });
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
