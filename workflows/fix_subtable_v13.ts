/**
 * 修复子表 V13：精确勾选"随主数据一同新增"复选框
 * 根因：第8个复选框（随主数据一同新增）未勾选
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
  console.log('[FIX SUBTABLE V13]\n');
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

    // ====== 精确找到"随主数据一同新增"的checkbox ======
    // 在属性面板中，找到"新增主数据时"区域，其下有一个"随主数据一同新增"的checkbox
    // 该checkbox的容器结构: .field-sub-config-component > .x-check > .check-label > input

    const checkboxInfo = await page.evaluate(() => {
      const allCheckboxes = [...document.querySelectorAll('input[type="checkbox"]')];
      const results: any[] = [];

      for (const cb of allCheckboxes) {
        // 向上最多走3层，检查该层的text是否包含"随主数据一同新增"
        let current: Element | null = cb;
        for (let i = 0; i < 5 && current; i++) {
          const text = ((current as HTMLElement).innerText || '').trim();
          if (text === '随主数据一同新增' || text.startsWith('随主数据一同新增')) {
            results.push({
              index: allCheckboxes.indexOf(cb),
              checked: (cb as HTMLInputElement).checked,
              disabled: (cb as HTMLInputElement).disabled,
              level: i,
              containerTag: current.tagName,
              containerClass: (current as HTMLElement).className?.substring(0, 100),
            });
            break;
          }
          current = current.parentElement;
        }
      }
      return results;
    });

    console.log(`随主数据一同新增 checkbox匹配: ${JSON.stringify(checkboxInfo, null, 2)}`);

    if (checkboxInfo.length > 0) {
      const target = checkboxInfo[0]; // 最接近的匹配
      console.log(`当前状态: checked=${target.checked}`);

      if (!target.checked) {
        // 精确点击这个checkbox
        console.log('需要勾选...');
        await page.evaluate((idx) => {
          const allCB = [...document.querySelectorAll('input[type="checkbox"]')];
          if (allCB[idx] && !(allCB[idx] as HTMLInputElement).disabled) {
            (allCB[idx] as HTMLInputElement).click();
          }
        }, target.index);

        await page.waitForTimeout(1000);

        // 验证
        const verified = await page.evaluate((idx) => {
          const allCB = [...document.querySelectorAll('input[type="checkbox"]')];
          return (allCB[idx] as HTMLInputElement)?.checked;
        }, target.index);

        console.log(`验证勾选: ${verified ? '✓ 已勾选' : '✗ 失败'}`);
      } else {
        console.log('已勾选，无需操作');
      }
    }

    // ====== 保存 ======
    console.log('\n保存...');
    const saveBtn = page.locator('button:has-text("保存")').first();
    await saveBtn.click({ force: true });
    await page.waitForTimeout(5000);

    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`保存: ${pageText.includes('保存成功') ? '✓' : '?'}`);

    await page.screenshot({ path: 'screenshots/v13-saved.png', fullPage: true });

    // ====== 验证录入页 ======
    console.log('\n====== 验证录入页 ======');
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

    const formCheck = await page.evaluate(() => {
      const form = document.querySelector('.fx-form.form-modal');
      if (!form) return { error: 'no form' };
      return {
        hasSubtable: (form as HTMLElement).innerText?.includes('订单明细'),
        fieldWidgets: [...form.querySelectorAll('[data-widgetname]')].map(el => ({
          name: el.getAttribute('data-widgetname'),
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 50),
        })),
        innerText: (form as HTMLElement).innerText?.trim(),
      };
    });

    console.log(`子表显示: ${formCheck.hasSubtable ? '✓ 成功！' : '✗ 仍不显示'}`);
    console.log(`表单字段: ${JSON.stringify(formCheck.fieldWidgets.map(f => f.text))}`);
    console.log(`表单内容: ${formCheck.innerText?.substring(0, 500)}`);

    await page.screenshot({ path: 'screenshots/v13-verify.png', fullPage: true });

    console.log('\n====== V13 完成 ======');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
