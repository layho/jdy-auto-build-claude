/**
 * 发布表单 V2 - 明确点击"表单发布"tab并发布
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
  console.log('[PUBLISH FORM V2]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入编辑器 ======
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

    // ====== 先保存 ======
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      console.log('✓ 已保存');
      await page.waitForTimeout(2000);
    }

    // ====== 找到并点击"表单发布"tab ======
    // 分析tab结构
    const tabInfo = await page.evaluate(() => {
      // Find all elements that could be tabs
      const allEls = [...document.querySelectorAll('*')];
      const tabEls = allEls.filter(el => {
        const txt = (el.textContent || '').trim();
        return (txt === '表单发布' || txt === '表单设计' || txt === '扩展功能' || txt === '数据管理') &&
          (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 60;
      });

      return tabEls.map(el => ({
        tag: el.tagName,
        text: (el.textContent || '').trim(),
        class: (el as HTMLElement).className?.substring(0, 150),
        id: el.id,
        rect: JSON.stringify(el.getBoundingClientRect()),
        clickable: el.onclick !== null || el.getAttribute('role') === 'tab' || el.tagName === 'A' || el.tagName === 'BUTTON',
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className?.substring(0, 100),
      }));
    });

    console.log(`Tab元素: ${JSON.stringify(tabInfo, null, 2)}`);

    // 点击"表单发布" tab
    const publishTabEl = page.locator('[class*="tab"]:has-text("表单发布")').first();
    if (await publishTabEl.count() === 0) {
      // Try clicking by text directly
      await page.locator('text="表单发布"').first().click({ force: true });
    } else {
      await publishTabEl.click({ force: true });
    }
    console.log('已点击表单发布tab');
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n表单发布页面:\n${text.substring(0, 2000)}`);

    await page.screenshot({ path: 'screenshots/publish-tab.png', fullPage: true });

    // ====== 点击发布 ======
    // 查找所有按钮
    const buttonsOnPage = await page.evaluate(() => {
      return [...document.querySelectorAll('button')]
        .filter(b => (b as HTMLElement).offsetHeight > 0)
        .map(b => ({
          text: (b.textContent || '').trim().substring(0, 30),
          class: b.className?.substring(0, 120),
        }));
    });
    console.log(`按钮: ${JSON.stringify(buttonsOnPage)}`);

    // 尝试点击发布
    for (const sel of ['button:has-text("发布")', 'button:has-text("立即发布")', 'button:has-text("确认发布")', 'text="发布"']) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        console.log(`点击: ${sel}`);
        await btn.click({ force: true });
        await page.waitForTimeout(3000);
        break;
      }
    }

    // 检查是否有确认弹窗
    const confirmDlg = page.locator('button:has-text("确定"), button:has-text("确认发布"), button:has-text("发布")').first();
    if (await confirmDlg.count() > 0 && await confirmDlg.isVisible().catch(() => false)) {
      await confirmDlg.click({ force: true });
      console.log('✓ 已确认发布');
      await page.waitForTimeout(2000);
    }

    // 检查页面反馈
    const finalText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n结果: ${finalText.includes('成功') ? '✓ 发布成功' : finalText.includes('已发布') ? '✓ 已发布' : '检查中...'}`);

    await page.screenshot({ path: 'screenshots/publish-done.png', fullPage: true });

    // ====== 验证 ======
    console.log('\n====== 验证 ======');
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

    // 更精确地检查子表 - 检查form区域是否有订单明细
    const hasSubtableInForm = await page.evaluate(() => {
      // 找所有包含提交按钮的高z-index容器内的"订单明细"
      const allEls = [...document.querySelectorAll('*')];
      const submitBtn = allEls.find(el => {
        const txt = (el.textContent || '').trim();
        return txt === '提交' && el.tagName === 'BUTTON' && (el as HTMLElement).offsetHeight > 0;
      });

      if (!submitBtn) return false;

      // 找包含submit按钮的form容器
      let formContainer = submitBtn.parentElement;
      for (let i = 0; i < 10 && formContainer; i++) {
        if ((formContainer as HTMLElement).innerText?.includes('订单明细')) {
          return true;
        }
        formContainer = formContainer.parentElement;
      }
      return false;
    });

    console.log(`子表在表单中: ${hasSubtableInForm ? '✓ 已显示' : '✗ 仍不显示'}`);

    await page.screenshot({ path: 'screenshots/publish-verify-v2.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
