/**
 * 诊断：在"成员"tab中找到齐娜并设置权限
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 找到齐娜并设置权限...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1060b33b91be59b687ca54/edit#/edit', {
      waitUntil: 'domcontentloaded',
    });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 点表单发布
    await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // 点添加成员
    await page.locator('button:has-text("添加成员")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // 切换到"成员" tab
    console.log('[DIAG] 切换到"成员" tab...');
    const memberTab = page.locator('[class*="header-item"]:has-text("成员"), .tab-header-item:has-text("成员")').first();
    console.log(`[DIAG] 成员tab count: ${await memberTab.count()}`);

    if (await memberTab.count() > 0) {
      await memberTab.click({ force: true });
      await page.waitForTimeout(1500);
    }

    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 成员tab内容:\n${text.substring(0, 3000)}`);
    await page.screenshot({ path: 'screenshots/diag-member-tab.png', fullPage: true });

    // 搜索"齐娜"
    console.log('\n[DIAG] 搜索"齐娜"...');
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="search"], input[placeholder*="关键字"]').first();
    console.log(`[DIAG] 搜索框 count: ${await searchInput.count()}`);

    if (await searchInput.count() > 0 && await searchInput.isVisible().catch(() => false)) {
      await searchInput.click({ force: true });
      await searchInput.fill('齐娜');
      await page.waitForTimeout(1500);

      text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 搜索结果:\n${text.substring(0, 3000)}`);
      await page.screenshot({ path: 'screenshots/diag-search-qina.png', fullPage: true });
    } else {
      // 没搜索框，直接找"齐娜"
      const qinaEls = page.locator('[class*="tree"] [class*="node"]:has-text("齐娜"), span:has-text("齐娜")');
      console.log(`[DIAG] "齐娜"匹配数: ${await qinaEls.count()}`);
    }

    // 找所有含"齐娜"的元素
    const allQina = await page.$$eval('span, div, li', els =>
      els.filter(el => {
        const t = el.textContent?.trim() || '';
        return t.includes('齐娜');
      }).map(el => ({
        tag: el.tagName,
        text: t,
        class: (el as HTMLElement).className?.substring(0, 100),
      }))
    );
    console.log(`[DIAG] 含"齐娜"的元素:`, allQina);

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
