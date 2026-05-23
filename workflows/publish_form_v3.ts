/**
 * 发布表单 - 直接导航到表单发布页
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
  console.log('[PUBLISH FORM V3]\n');
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
      await page.waitForTimeout(2000);
    }

    // 找所有可点击的tab/标签元素
    const tabElements = await page.evaluate(() => {
      // 查找所有可能是tab的元素
      const candidates = [...document.querySelectorAll('*')].filter(el => {
        const txt = (el.textContent || '').trim();
        return txt === '表单发布' && (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 60;
      });
      return candidates.map(el => {
        // 找最近的clickable ancestor
        let clickable = el;
        for (let i = 0; i < 5; i++) {
          if (clickable.tagName === 'A' || clickable.tagName === 'BUTTON' || clickable.tagName === 'LI' ||
              clickable.getAttribute('role') === 'tab' || clickable.onclick !== null ||
              (clickable.className || '').includes('tab')) {
            break;
          }
          if (clickable.parentElement) clickable = clickable.parentElement;
        }
        return {
          tag: clickable.tagName,
          class: (clickable as HTMLElement).className?.substring(0, 200),
          role: clickable.getAttribute('role'),
          rect: JSON.stringify(clickable.getBoundingClientRect()),
        };
      });
    });

    console.log(`表单发布tab候选人: ${JSON.stringify(tabElements, null, 2)}`);

    // 使用多种方式点击"表单发布"
    let tabClicked = false;

    // 方式1: 直接用text=
    const textLoc = page.locator('text="表单发布"').first();
    if (!tabClicked && await textLoc.count() > 0 && await textLoc.isVisible().catch(() => false)) {
      console.log('方式1: 点击text="表单发布"');
      await textLoc.click({ force: true });
      tabClicked = true;
    }

    // 方式2: 包含表单发布的li/a
    if (!tabClicked) {
      const liLoc = page.locator('li:has-text("表单发布"), a:has-text("表单发布"), [role="tab"]:has-text("表单发布")').first();
      if (await liLoc.count() > 0 && await liLoc.isVisible().catch(() => false)) {
        console.log('方式2: 点击li/a');
        await liLoc.click({ force: true });
        tabClicked = true;
      }
    }

    // 方式3: dispatchEvent
    if (!tabClicked) {
      console.log('方式3: dispatchEvent');
      await page.evaluate(() => {
        const all = [...document.querySelectorAll('*')];
        const el = all.find(e => (e.textContent || '').trim() === '表单发布' && (e as HTMLElement).offsetHeight > 0 && (e as HTMLElement).offsetHeight < 60);
        if (el) (el as HTMLElement).click();
      });
      tabClicked = true;
    }

    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n当前页面内容:\n${pageText.substring(0, 2000)}`);

    // 查找发布相关按钮
    const allBtns = await page.evaluate(() => {
      return [...document.querySelectorAll('button')]
        .filter(b => (b as HTMLElement).offsetHeight > 0)
        .map(b => ({
          text: (b.textContent || '').trim().substring(0, 40),
          class: b.className?.substring(0, 120),
        }));
    });
    console.log(`\n所有按钮: ${JSON.stringify(allBtns, null, 2)}`);

    // 点击发布
    const pubBtn = page.locator('button:has-text("发布")').first();
    if (await pubBtn.count() > 0 && await pubBtn.isVisible().catch(() => false)) {
      await pubBtn.click({ force: true });
      console.log('✓ 已点击发布按钮');
      await page.waitForTimeout(3000);
    }

    // 检查是否有确认对话框
    const confirmBtns = page.locator('button:has-text("确定"), button:has-text("确认"), button:has-text("发布")').first();
    if (await confirmBtns.count() > 0 && await confirmBtns.isVisible().catch(() => false)) {
      await confirmBtns.click({ force: true });
      console.log('✓ 已确认发布');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/publish-v3.png', fullPage: true });

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

    // 检查form中是否有子表 - 找包含提交按钮的容器
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
    await page.screenshot({ path: 'screenshots/publish-verify-v3.png', fullPage: true });

    console.log('\n====== 完成 ======');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
