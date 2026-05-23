/**
 * 修复子表显示字段 - 添加产品名称、数量、单价、金额
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
  console.log('[FIX SUBTABLE COLUMNS]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
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

    // ====== 点击订单明细字段 ======
    const orderDetailField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    await orderDetailField.click({ force: true });
    console.log('✓ 已点击订单明细');
    await page.waitForTimeout(2000);

    // ====== 点击"显示字段"配置 ======
    console.log('查找显示字段配置...');

    // 在属性面板中找"显示字段"文本，然后点击它或它旁边的设置按钮
    const displayFieldInfo = await page.evaluate(() => {
      // 查找"显示字段"相关的元素
      const allEls = [...document.querySelectorAll('*')];
      const displayFieldEl = allEls.find(el => {
        const txt = (el.textContent || '').trim();
        return (txt === '显示字段' || txt.startsWith('显示字段')) &&
          (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 40;
      });

      if (!displayFieldEl) return { error: 'no 显示字段 element' };

      // 找"显示 3 个字段"这种文本
      const showCountEl = allEls.find(el => {
        const txt = (el.textContent || '').trim();
        return txt.includes('显示') && txt.includes('个字段') &&
          (el as HTMLElement).offsetHeight > 0;
      });

      return {
        displayFieldTag: displayFieldEl.tagName,
        displayFieldClass: (displayFieldEl as HTMLElement).className?.substring(0, 100),
        displayFieldParentHTML: displayFieldEl.parentElement?.outerHTML?.substring(0, 500),
        showCountTag: showCountEl?.tagName,
        showCountText: showCountEl?.textContent?.trim(),
        showCountClass: (showCountEl as HTMLElement)?.className?.substring(0, 100),
      };
    });

    console.log(JSON.stringify(displayFieldInfo, null, 2));

    // 点击"显示 3 个字段"打开字段选择器
    const showCountBtn = page.locator('[class*="config-content"]:has-text("个字段")').first();
    if (await showCountBtn.count() === 0) {
      // try 找包含"显示"和"个字段"的元素
      const altEl = page.locator('div:has-text("显示"), span:has-text("显示")').filter({ hasText: '个字段' }).first();
      if (await altEl.count() > 0) {
        await altEl.click({ force: true });
        console.log('✓ 点击显示字段配置');
      }
    } else {
      await showCountBtn.click({ force: true });
      console.log('✓ 点击显示字段配置');
    }

    await page.waitForTimeout(2000);

    // 检查是否有弹窗/下拉
    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n页面:\n${pageText.substring(pageText.indexOf('显示字段'), pageText.indexOf('显示字段') + 500)}`);

    await page.screenshot({ path: 'screenshots/fix-columns-1.png', fullPage: true });

    // 查找字段选择checkbox列表
    const fieldSelectors = await page.evaluate(() => {
      // 找dropdown/select中所有checkbox选项
      const dropdowns = [...document.querySelectorAll('[class*="dropdown"], [class*="select"], [class*="picker"], [class*="popup"], [class*="popper"]')]
        .filter(el => (el as HTMLElement).offsetHeight > 50);

      return dropdowns.map(d => ({
        class: (d as HTMLElement).className?.substring(0, 200),
        rect: JSON.stringify(d.getBoundingClientRect()),
        innerText: (d as HTMLElement).innerText?.substring(0, 500),
        checkboxes: [...d.querySelectorAll('input[type="checkbox"]')].map(cb => ({
          checked: (cb as HTMLInputElement).checked,
          label: cb.parentElement?.textContent?.trim()?.substring(0, 50),
        })),
      }));
    });

    console.log(`\n字段选择器: ${JSON.stringify(fieldSelectors, null, 2)}`);

    // 在字段选择弹窗中勾选产品名称、数量、单价、金额
    // 弹窗class: x-biz-multi-field-selector-popover
    // 字段顺序: 全选[0], 订单管理[1], 产品名称[2], 数量[3], 单价[4], 金额[5]
    await page.evaluate(() => {
      const popover = document.querySelector('.x-biz-multi-field-selector-popover');
      if (!popover) return;

      const checkboxes = [...popover.querySelectorAll('input[type="checkbox"]')];
      // 跳过第0个(全选)和第1个(订单管理已勾选)，勾选第2-5个
      for (let i = 2; i < checkboxes.length; i++) {
        const cb = checkboxes[i] as HTMLInputElement;
        if (!cb.checked && !cb.disabled) {
          cb.click();
        }
      }
    });

    await page.waitForTimeout(500);
    // 关闭弹窗 - 点击弹窗外或按Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/fix-columns-2.png', fullPage: true });

    // ====== 保存 ======
    console.log('\n保存...');
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      await page.waitForTimeout(5000);
      console.log('✓ 已保存');
    }

    // ====== 验证 ======
    console.log('\n====== 验证 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await page.locator('body').first().innerText().catch(() => '');
    if (text.includes('仅添加数据')) {
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

    // 检查子表列
    const columns = await page.evaluate(() => {
      const subtable = document.querySelector('.fx-related-form');
      if (!subtable) return { error: 'no subtable' };
      const headers = [...subtable.querySelectorAll('.related-form-title')];
      return {
        columnCount: headers.length,
        columns: headers.map(h => (h as HTMLElement).title || h.textContent?.trim()),
        subtableText: (subtable as HTMLElement).innerText?.trim()?.substring(0, 200),
      };
    });

    console.log(JSON.stringify(columns, null, 2));
    await page.screenshot({ path: 'screenshots/fix-columns-3-verify.png', fullPage: true });

    console.log('\n====== 完成 ======');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
