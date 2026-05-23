/**
 * 诊断 choose-form div 的内部结构，找到真正的表单选择下拉组件
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
  console.log('[DIAG CHOOSE FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
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

    // 先检查当前是否有订单明细字段，如果有先删除
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log('先删除现有订单明细字段...');
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(600);
      const deleteBtn = subField.locator('.btn-delete.btn-trash').first();
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(800);
        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
        if (await confirmBtn.count() > 0) await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
      await page.locator('button:has-text("保存")').first().click({ force: true });
      await page.waitForTimeout(1500);
      await waitForStableDOM(page);
      console.log('✓ 已删除并保存');
    }

    // 添加关联子表
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    // 选"绑定已有表单"
    const bindExisting = page.getByText('绑定已有表单').first();
    if (await bindExisting.count() > 0) {
      await bindExisting.click({ force: true });
      console.log('✓ 已选择绑定已有表单');
      await page.waitForTimeout(1500);
    }

    // 深入检查 choose-form 的HTML
    const htmlInfo = await page.evaluate(() => {
      const chooseForm = document.querySelector('.choose-form');
      if (!chooseForm) return { error: 'no .choose-form found' };

      return {
        outerHTML: chooseForm.outerHTML.substring(0, 3000),
        innerHTML: chooseForm.innerHTML.substring(0, 3000),
        childrenCount: chooseForm.children.length,
        children: [...chooseForm.children].map(c => ({
          tag: c.tagName,
          class: (c as HTMLElement).className?.substring(0, 200),
          text: (c.textContent || '').trim().substring(0, 100),
          html: c.outerHTML.substring(0, 800),
        })),
        // Also check all descendants that could be interactive
        interactiveDescendants: [...chooseForm.querySelectorAll('input, button, select, [class*="dropdown"], [class*="select"], [class*="picker"], [class*="trigger"], [tabindex], [role="button"], [role="listbox"]')].map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 200),
          text: (el.textContent || '').trim().substring(0, 100),
          html: el.outerHTML.substring(0, 600),
          visible: (el as HTMLElement).offsetHeight > 0,
        })),
      };
    });

    console.log('\n=== choose-form HTML结构 ===');
    console.log(`children count: ${htmlInfo.childrenCount}`);
    htmlInfo.children?.forEach((c: any, i: number) => {
      console.log(`\nchild[${i}]: <${c.tag}> class="${c.class}"`);
      console.log(`  text: "${c.text}"`);
      console.log(`  html: ${c.html}`);
    });

    console.log('\n=== 交互式子元素 ===');
    htmlInfo.interactiveDescendants?.forEach((el: any, i: number) => {
      console.log(`\n[${i}] <${el.tag}> class="${el.class}" visible=${el.visible}`);
      console.log(`  text: "${el.text}"`);
      console.log(`  html: ${el.html}`);
    });

    // 也检查整个dialog的HTML
    const dialogHTML = await page.evaluate(() => {
      const dialog = document.querySelector('.fx-relatedform-create-path');
      if (!dialog) return 'no dialog found';
      return dialog.outerHTML.substring(0, 5000);
    });
    console.log(`\n=== Dialog HTML (前5000字符) ===\n${dialogHTML}`);

    await page.screenshot({ path: 'screenshots/diag-choose-form.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
