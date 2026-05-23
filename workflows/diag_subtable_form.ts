/**
 * 诊断：表单中子表的结构和"添加"按钮位置
 * 以及关联数据/选择数据对话框的交互方式
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';

async function readPage(page: Page): Promise<string> {
  return await page.locator('body').first().innerText().catch(() => '') || '';
}

async function main() {
  console.log('[DIAG SUBTABLE FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 进入录入表单 ======
    console.log('====== 1. 打开录入表单 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 切换到管理全部数据
    let text = await readPage(page);
    if (text.includes('仅添加数据')) {
      await page.locator('text=仅添加数据').first().click({ force: true });
      await page.waitForTimeout(1000);
      const manageAll = page.locator('[class*="option"]:has-text("管理全部数据")').first();
      if (await manageAll.count() > 0) await manageAll.click({ force: true });
      await page.waitForTimeout(2000);
    }

    // 点击"添加"打开表单
    const addBtn = page.locator('button:has-text("添加")').first();
    if (await addBtn.count() > 0) await addBtn.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(`表单内容:\n${text.substring(0, 2000)}`);

    // ====== 2. 分析表单中子表区域 ======
    console.log('\n====== 2. 子表区域分析 ======');
    const subtableInfo = await page.evaluate(() => {
      // 找所有包含"订单明细"的元素
      const allEls = [...document.querySelectorAll('*')];
      const orderDetailEls = allEls.filter(el => {
        const txt = (el.textContent || '').trim();
        return txt === '订单明细' && (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 100;
      });

      const results: any = { count: orderDetailEls.length, items: [] };

      for (const el of orderDetailEls) {
        // 向上查找包含子表组件的容器
        let current = el.parentElement;
        let subtableContainer = null;
        for (let i = 0; i < 10 && current; i++) {
          const cls = current.className || '';
          if (cls.includes('subtable') || cls.includes('sub-table') ||
              cls.includes('related') || cls.includes('child') ||
              cls.includes('fx-grid') || cls.includes('table-wrap') ||
              cls.includes('detail-table') || cls.includes('embed')) {
            subtableContainer = current;
            break;
          }
          current = current.parentElement;
        }

        // 找整个grandparent中的所有按钮
        const gp = el.parentElement?.parentElement?.parentElement?.parentElement;
        const allButtons = [...(gp?.querySelectorAll('button') || [])]
          .filter(b => (b as HTMLElement).offsetHeight > 0)
          .map(b => ({
            text: b.textContent?.trim(),
            class: b.className?.substring(0, 120),
          }));

        results.items.push({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          parentTag: el.parentElement?.tagName,
          parentClass: el.parentElement?.className?.substring(0, 200),
          subtableContainerTag: subtableContainer?.tagName,
          subtableContainerClass: subtableContainer?.className?.substring(0, 200),
          subtableContainerHTML: subtableContainer?.outerHTML?.substring(0, 2000),
          nearbyButtons: allButtons.slice(0, 20),
        });
      }

      return results;
    });

    console.log(JSON.stringify(subtableInfo, null, 2));

    // ====== 3. 测试关联数据对话框交互 ======
    console.log('\n====== 3. 测试关联数据对话框 ======');

    // 先点关联数据打开对话框
    const assocBtn = page.locator('button:has-text("关联数据")').first();
    await assocBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // 分析对话框中的行 - 直接点击行看会发生什么
    const dialogInfo = await page.evaluate(() => {
      const dialogs = [...document.querySelectorAll('.fx-lookup-dialog')]
        .filter(d => (d as HTMLElement).offsetHeight > 0);

      return dialogs.map(d => {
        const rows = [...d.querySelectorAll('tr')];
        const tbody = d.querySelector('tbody');
        return {
          class: d.className?.substring(0, 200),
          rowCount: rows.length,
          headerRowHTML: rows[0]?.outerHTML?.substring(0, 500),
          firstDataRowHTML: rows[1]?.outerHTML?.substring(0, 1000),
          tbodyHTML: tbody?.outerHTML?.substring(0, 2000),
          // Check for radio buttons
          radioCount: d.querySelectorAll('input[type="radio"]').length,
          checkboxCount: d.querySelectorAll('input[type="checkbox"]').length,
          // Check for any clickable row indicators
          rowClickHandlers: rows[1]?.getAttribute('class') || '',
        };
      });
    });

    console.log(JSON.stringify(dialogInfo, null, 2));

    // 尝试直接点击数据行（不是radio）
    const firstDataRow = page.locator('.fx-lookup-dialog tbody tr').first();
    if (await firstDataRow.count() > 0) {
      console.log('点击第一行数据...');
      await firstDataRow.click({ force: true });
      await page.waitForTimeout(2000);

      // 检查对话框是否关闭
      const dialogStillOpen = await page.locator('.fx-lookup-dialog').first().isVisible().catch(() => false);
      console.log(`对话框是否仍打开: ${dialogStillOpen}`);
      if (dialogStillOpen) {
        // 尝试点radio
        const radio = page.locator('.fx-lookup-dialog input[type="radio"]').first();
        if (await radio.count() > 0) {
          console.log('点击radio...');
          await radio.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }
    }

    // 检查对话框是否关闭
    const dialogVisible = await page.locator('.fx-lookup-dialog').first().isVisible().catch(() => false);
    console.log(`对话框可见: ${dialogVisible}`);

    text = await readPage(page);
    console.log(`\n当前页面:\n${text.substring(0, 800)}`);

    await page.screenshot({ path: 'screenshots/diag-subtable-form.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
