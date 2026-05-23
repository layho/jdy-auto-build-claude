/**
 * 诊断：非空状态下（已有1个表单）如何创建新表单
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[DIAG] 非空状态创建表单诊断...\n');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 1. 读页面内容
    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 页面内容:\n${text.substring(0, 800)}\n`);

    // 2. 检查 entry-item
    const entryItem = page.locator('.entry-item:has-text("新建表单")').first();
    const entryCount = await entryItem.count();
    console.log(`[DIAG] .entry-item("新建表单") count=${entryCount}`);
    if (entryCount > 0) {
      const visible = await entryItem.isVisible().catch(() => false);
      console.log(`[DIAG]   visible=${visible}`);
    }

    // 3. 列出所有含 "新建" 的按钮/元素
    const newEls = await page.$$eval('button, a, span, li, div', els =>
      els.filter(el => {
        const t = el.textContent?.trim() || '';
        return t.includes('新建') && t.length < 20 && el.children.length <= 1;
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        class: (el as HTMLElement).className?.substring(0, 100),
      }))
    );
    console.log(`[DIAG] 含"新建"的元素:`);
    newEls.forEach(e => console.log(`  <${e.tag}> "${e.text}" class="${e.class}"`));

    // 4. 检查侧边栏按钮
    const sidebarBtns = await page.$$eval('.fx-entry-create button, [class*="entry-create"] button, [class*="entry"] button, [class*="sidebar"] button, [class*="tree"] button', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        class: (el as HTMLElement).className?.substring(0, 100),
        title: (el as HTMLElement).title,
      }))
    );
    console.log(`[DIAG] 侧边栏可见按钮:`);
    sidebarBtns.forEach(b => console.log(`  <${b.tag}> text="${b.text}" title="${b.title}" class="${b.class}"`));

    // 5. 截图
    await page.screenshot({ path: 'screenshots/diag-nonempty.png', fullPage: true });
    console.log('[DIAG] 截图已保存');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
