/**
 * 发布表单 V4 - 直接点击LI tab元素
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function main() {
  console.log('[PUBLISH FORM V4]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入编辑器
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    const entry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await entry.hover({ force: true });
    await page.waitForTimeout(600);
    await entry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 先保存
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      console.log('✓ 已保存');
      await page.waitForTimeout(3000);
    }

    // 点击"表单发布"LI tab
    console.log('点击表单发布tab...');
    const pubTab = page.locator('li.tab-header-item:has-text("表单发布")').first();
    if (await pubTab.count() > 0) {
      await pubTab.click({ force: true });
      console.log('✓ 已点击表单发布tab (LI)');
    } else {
      // fallback: dispatchEvent
      await page.evaluate(() => {
        const allLi = [...document.querySelectorAll('li')];
        const pubLi = allLi.find(li => (li.textContent || '').trim() === '表单发布');
        if (pubLi) (pubLi as HTMLElement).click();
      });
      console.log('✓ dispatchEvent点击表单发布');
    }

    await page.waitForTimeout(4000);
    await waitForStableDOM(page);

    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n页面内容:\n${pageText.substring(0, 2000)}`);

    // 找发布按钮
    const allBtns = await page.evaluate(() => {
      return [...document.querySelectorAll('button')]
        .filter(b => (b as HTMLElement).offsetHeight > 0)
        .map(b => ({
          text: (b.textContent || '').trim().substring(0, 40),
          class: b.className?.substring(0, 120),
        }));
    });
    console.log(`\n按钮: ${JSON.stringify(allBtns, null, 2)}`);

    // 尝试点击发布
    for (const sel of ['button:has-text("发布")', 'button:has-text("对成员发布")', 'button:has-text("确认发布")', '[class*="publish-btn"]']) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        const txt = await btn.innerText().catch(() => '');
        console.log(`\n点击: "${txt}"`);
        await btn.click({ force: true });
        await page.waitForTimeout(3000);
        break;
      }
    }

    await page.screenshot({ path: 'screenshots/publish-v4.png', fullPage: true });

    // ====== 验证 ======
    console.log('\n====== 验证录入页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let entryText = await page.locator('body').first().innerText().catch(() => '');
    if (entryText.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    const addBtn = page.locator('button:has-text("添加")').first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    entryText = await page.locator('body').first().innerText().catch(() => '');

    const subtableVisible = await page.evaluate(() => {
      const allEls = [...document.querySelectorAll('*')];
      const submitBtn = allEls.find(el =>
        (el.textContent || '').trim() === '提交' && el.tagName === 'BUTTON' && (el as HTMLElement).offsetHeight > 0
      );
      if (!submitBtn) return false;
      let container = submitBtn.parentElement;
      for (let i = 0; i < 10 && container; i++) {
        if ((container as HTMLElement).innerText?.includes('订单明细')) return true;
        container = container.parentElement;
      }
      return false;
    });

    console.log(`子表在表单中: ${subtableVisible ? '✓' : '✗'}`);
    if (!subtableVisible) {
      console.log(`表单内容:\n${entryText.substring(entryText.indexOf('订单管理'), entryText.indexOf('订单管理') + 400)}`);
    }
    await page.screenshot({ path: 'screenshots/publish-verify-v4.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
