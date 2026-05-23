/**
 * 诊断：进入应用后台，查找权限设置
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[DIAG] 应用后台权限设置...\n');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 点击"应用后台"
    console.log('[DIAG] 点击"应用后台"...');
    const adminBtn = page.locator('text=应用后台').first();
    if (await adminBtn.count() > 0) {
      await adminBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      console.log(`[DIAG] URL: ${page.url()}`);
      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 页面内容:\n${text.substring(0, 2000)}`);

      // 查找侧边栏菜单
      const menuItems = await page.$$eval('[class*="nav"] *, [class*="menu"] *, [class*="sidebar"] *, [class*="side"] *', els =>
        els.filter(el => {
          const t = (el.textContent?.trim() || '');
          return t.length > 0 && t.length < 30 && el.children.length === 0;
        }).map(el => ({
          text: t,
          tag: el.tagName,
        }))
      );
      const unique = menuItems.filter((item, i, arr) =>
        arr.findIndex(t => t.text === item.text) === i
      ).slice(0, 50);
      console.log(`\n[DIAG] 后台菜单项:`);
      unique.forEach(item => console.log(`  "${item.text}"`));

      await page.screenshot({ path: 'screenshots/diag-backend.png', fullPage: true });
    } else {
      console.log('[DIAG] 未找到"应用后台"');
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
