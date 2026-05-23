/**
 * 修复子表 V12：重新验证子表配置，确保"随主数据一同新增"已勾选
 * 1. 进入编辑器
 * 2. 点击订单明细字段
 * 3. 检查并启用"随主数据一同新增"
 * 4. 保存并验证
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
  console.log('[FIX SUBTABLE V12]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入编辑器 ======
    console.log('====== 1. 进入编辑器 ======');
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

    await page.screenshot({ path: 'screenshots/v12-1-editor.png', fullPage: true });

    // ====== 2. 检查当前字段 ======
    console.log('\n====== 2. 检查字段 ======');
    const fields = await page.evaluate(() => {
      return [...document.querySelectorAll('.fx-field-layout.field')].map(el => ({
        text: (el as HTMLElement).innerText?.trim()?.substring(0, 80),
        class: (el as HTMLElement).className?.substring(0, 200),
        dataWidgetName: el.getAttribute('data-widgetname') || '',
      }));
    });
    console.log(`当前字段 (${fields.length}):`);
    fields.forEach((f, i) => console.log(`  [${i}] ${f.text}`));

    // ====== 3. 点击订单明细字段 ======
    console.log('\n====== 3. 点击订单明细 ======');
    const orderDetailField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await orderDetailField.count() > 0) {
      await orderDetailField.click({ force: true });
      console.log('✓ 已点击订单明细字段');
      await page.waitForTimeout(2000);
    } else {
      console.log('✗ 订单明细字段不存在！需要重新添加');
    }

    await page.screenshot({ path: 'screenshots/v12-2-property-panel.png', fullPage: true });

    // ====== 4. 检查属性面板 ======
    console.log('\n====== 4. 检查属性面板 ======');
    const propPanel = await page.evaluate(() => {
      // 找到属性面板
      const panels = [...document.querySelectorAll('[class*="design-config"], [class*="property"], .config-pane')]
        .filter(el => (el as HTMLElement).offsetWidth > 200 && (el as HTMLElement).offsetHeight > 200);

      return panels.map(p => ({
        class: (p as HTMLElement).className?.substring(0, 200),
        text: (p as HTMLElement).innerText?.trim()?.substring(0, 1000),
        // Find checkboxes
        checkboxes: [...p.querySelectorAll('input[type="checkbox"]')].map(cb => ({
          checked: (cb as HTMLInputElement).checked,
          disabled: (cb as HTMLInputElement).disabled,
          // Nearby text
          nearbyText: cb.parentElement?.parentElement?.textContent?.trim()?.substring(0, 100),
        })),
        // Find the "随主数据一同新增" text
        hasAddWithMain: (p as HTMLElement).innerText?.includes('随主数据一同新增'),
      }));
    });

    console.log(JSON.stringify(propPanel, null, 2));

    // ====== 5. 查找并勾选"随主数据一同新增" ======
    console.log('\n====== 5. 检查随主数据一同新增 ======');

    // Try to find the checkbox near "随主数据一同新增" text
    const addWithMainCheckbox = await page.evaluate(() => {
      // Find ALL checkboxes and check which one is for "随主数据一同新增"
      const allCheckboxes = [...document.querySelectorAll('input[type="checkbox"]')];
      for (const cb of allCheckboxes) {
        // Walk up to find enclosing label/container text
        let container = cb.parentElement;
        for (let i = 0; i < 8 && container; i++) {
          const text = (container as HTMLElement).innerText || '';
          if (text.includes('随主数据一同新增')) {
            return {
              checked: (cb as HTMLInputElement).checked,
              disabled: (cb as HTMLInputElement).disabled,
              containerClass: (container as HTMLElement).className?.substring(0, 100),
            };
          }
          container = container.parentElement;
        }
      }
      return { error: 'checkbox not found' };
    });

    console.log(`随主数据一同新增: ${JSON.stringify(addWithMainCheckbox)}`);

    // If not checked, try to check it
    if (addWithMainCheckbox.checked === false) {
      console.log('需要勾选随主数据一同新增...');
      const checked = await page.evaluate(() => {
        const allCheckboxes = [...document.querySelectorAll('input[type="checkbox"]')];
        for (const cb of allCheckboxes) {
          let container = cb.parentElement;
          for (let i = 0; i < 8 && container; i++) {
            const text = (container as HTMLElement).innerText || '';
            if (text.includes('随主数据一同新增')) {
              if (!(cb as HTMLInputElement).disabled) {
                (cb as HTMLInputElement).click();
                return true;
              }
              return 'disabled';
            }
            container = container.parentElement;
          }
        }
        return false;
      });
      console.log(`勾选结果: ${checked}`);
    }

    // ====== 6. 保存 ======
    console.log('\n====== 6. 保存 ======');
    const saveBtn = page.locator('button:has-text("保存")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true });
      console.log('✓ 已点击保存');
      await page.waitForTimeout(5000); // wait longer for save to complete
    }

    // Check save status
    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`保存状态: ${pageText.includes('保存成功') ? '✓ 成功' : '?'}`);

    await page.screenshot({ path: 'screenshots/v12-3-saved.png', fullPage: true });

    // ====== 7. 验证录入页 ======
    console.log('\n====== 7. 验证 ======');
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

    // Check form HTML
    const formCheck = await page.evaluate(() => {
      const form = document.querySelector('.fx-form.form-modal');
      if (!form) return { error: 'no form' };
      return {
        class: (form as HTMLElement).className?.substring(0, 200),
        hasSubtable: (form as HTMLElement).innerText?.includes('订单明细'),
        innerText: (form as HTMLElement).innerText?.trim()?.substring(0, 500),
        fieldWidgetNames: [...form.querySelectorAll('[data-widgetname]')].map(el => ({
          widgetname: el.getAttribute('data-widgetname'),
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 50),
        })),
      };
    });

    console.log(JSON.stringify(formCheck, null, 2));
    console.log(`\n子表显示: ${formCheck.hasSubtable ? '✓' : '✗'}`);
    await page.screenshot({ path: 'screenshots/v12-4-verify.png', fullPage: true });

    console.log('\n====== V12 完成 ======');
  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
