/**
 * 修复关联子表 V7：
 * 关键发现：choose-form 内的 .x-biz-entry-select-combo 才是表单选择下拉组件
 * 需要点击 .x-biz-dropdown-label 或 .x-biz-entry-select-combo 来打开表单选择器
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
  console.log('[FIX SUBTABLE V7]\n');
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

    // ====== 1. 检查并删除损坏的字段 ======
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log('删除损坏的订单明细字段...');
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(600);
      const deleteBtn = subField.locator('.btn-delete.btn-trash').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(800);
        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
        if (await confirmBtn.count() > 0) await confirmBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
      await page.locator('button:has-text("保存")').first().click({ force: true });
      console.log('✓ 已删除并保存');
      await page.waitForTimeout(1500);
      await waitForStableDOM(page);
    }

    // ====== 2. 重新添加关联子表 ======
    console.log('\n====== 2. 添加关联子表 ======');
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    // 选"绑定已有表单"
    const bindExisting = page.getByText('绑定已有表单').first();
    if (await bindExisting.count() > 0 && await bindExisting.isVisible().catch(() => false)) {
      await bindExisting.click({ force: true });
      console.log('✓ 已选择绑定已有表单');
      await page.waitForTimeout(1000);
    }

    // ====== 3. 关键：点击 .x-biz-entry-select-combo 下拉组件 ======
    // 定位到 choose-form 容器内的下拉组件
    const comboBox = page.locator('.choose-form .x-biz-entry-select-combo').first();
    const comboDropdown = page.locator('.choose-form .x-biz-dropdown-label').first();

    console.log(`\ncomboBox count: ${await comboBox.count()}, visible: ${await comboBox.isVisible().catch(() => false)}`);
    console.log(`comboDropdown count: ${await comboDropdown.count()}, visible: ${await comboDropdown.isVisible().catch(() => false)}`);

    // 点击下拉组件打开选择器
    if (await comboDropdown.count() > 0 && await comboDropdown.isVisible().catch(() => false)) {
      await comboDropdown.click({ force: true });
      console.log('✓ 已点击下拉组件');
    } else if (await comboBox.count() > 0 && await comboBox.isVisible().catch(() => false)) {
      await comboBox.click({ force: true });
      console.log('✓ 已点击comboBox');
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/subtable-v7-dropdown-open.png', fullPage: true });

    let text = await readPage(page);
    console.log(`\n下拉打开后:\n${text.substring(0, 2000)}`);

    // ====== 4. 查找并选择订单明细表 ======
    // 下拉内容可能在一个portal/popup中
    const popupSelectors = [
      '.x-biz-dropdown-popup:visible',
      '[class*="dropdown-popup"]:visible',
      '[class*="select-popup"]:visible',
      '[class*="popper"]:visible',
      '.x-popover:visible',
      '[class*="popover"]:visible',
    ];

    let popupFound = false;
    for (const sel of popupSelectors) {
      const popup = page.locator(sel).first();
      if (await popup.count() > 0 && await popup.isVisible().catch(() => false)) {
        const popupText = await popup.innerText().catch(() => '');
        console.log(`\n找到popup: ${sel}`);
        console.log(`内容: ${popupText.substring(0, 500)}`);
        popupFound = true;

        // 在popup中找订单明细表
        const detailInPopup = popup.locator(':has-text("订单明细表")').first();
        if (await detailInPopup.count() > 0 && await detailInPopup.isVisible().catch(() => false)) {
          await detailInPopup.click({ force: true });
          console.log('✓ 已选择订单明细表');
          await page.waitForTimeout(500);
        }
        break;
      }
    }

    if (!popupFound) {
      // 可能在 body 下层的 portal 中
      console.log('\n搜索body下的popup...');
      const bodyChildren = await page.evaluate(() => {
        const children = [...document.body.children];
        return children
          .filter(c => {
            const style = window.getComputedStyle(c);
            return style.position === 'fixed' || style.position === 'absolute' || c.className?.includes?.('pop') || c.className?.includes?.('drop') || c.className?.includes?.('popper') || c.className?.includes?.('select');
          })
          .map(c => ({
            tag: c.tagName,
            class: (c as HTMLElement).className?.substring(0, 200),
            text: (c.textContent || '').trim().substring(0, 300),
          }));
      });
      console.log(`body下popup子元素: ${bodyChildren.length}个`);
      bodyChildren.forEach((c: any, i: number) => console.log(`  [${i}] <${c.tag}> class="${c.class}" text="${c.text}"`));

      // 尝试找包含订单明细表的元素
      const detailEls = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll('*').forEach(el => {
          const txt = (el.textContent || '').trim();
          if (txt === '订单明细表') {
            const htmlEl = el as HTMLElement;
            const rect = htmlEl.getBoundingClientRect();
            const style = window.getComputedStyle(htmlEl);
            if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden') {
              results.push({
                tag: el.tagName,
                class: htmlEl.className?.substring(0, 200),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                // Check ancestor chain for popup
                ancestorPopup: (() => {
                  let p = el.parentElement;
                  while (p && p !== document.body) {
                    const cls = p.className || '';
                    if (cls.includes('pop') || cls.includes('drop') || cls.includes('select') || cls.includes('popper') || cls.includes('menu') || cls.includes('list')) {
                      return { tag: p.tagName, class: cls.substring(0, 200) };
                    }
                    p = p.parentElement;
                  }
                  return null;
                })(),
              });
            }
          }
        });
        return results;
      });

      console.log(`\n"订单明细表"可见元素: ${detailEls.length}个`);
      detailEls.forEach((d: any, i: number) => console.log(`  [${i}] <${d.tag}> class="${d.class}" ancestorPopup=${JSON.stringify(d.ancestorPopup)} rect=${JSON.stringify(d.rect)}`));

      // 如果有可见的订单明细表，直接点击
      if (detailEls.length > 0) {
        const detailText = page.getByText('订单明细表', { exact: true }).first();
        if (await detailText.count() > 0 && await detailText.isVisible().catch(() => false)) {
          await detailText.click({ force: true });
          console.log('✓ 直接点击订单明细表');
          await page.waitForTimeout(500);
        }
      } else {
        console.log('⚠ 没有看到订单明细表选项 - 可能下拉列表为空');
        // 尝试检查是否有搜索框
        const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="请输入"]').last();
        if (await searchInput.count() > 0 && await searchInput.isVisible().catch(() => false)) {
          console.log('尝试在搜索框中搜索...');
          await searchInput.fill('订单明细表');
          await page.waitForTimeout(1000);
        }
      }
    }

    // ====== 5. 点击确定 ======
    await page.waitForTimeout(500);
    text = await readPage(page);
    console.log(`\n确定前:\n${text.substring(0, 1000)}`);

    // 找dialog中的确定按钮
    const confirmBtns = page.locator('.fx-relatedform-create-path button:has-text("确定")');
    const cbCount = await confirmBtns.count();
    console.log(`dialog中确定按钮: ${cbCount}个`);

    if (cbCount > 0) {
      await confirmBtns.last().click({ force: true });
      console.log('✓ 已点击确定');
      await page.waitForTimeout(2000);
    }

    // ====== 6. 保存 ======
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('✓ 已保存');
    await page.waitForTimeout(2000);

    // ====== 7. 验证 ======
    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`\n最终字段: ${fields.join(' | ')}`);

    if (fields.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);

      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在') && !text.includes('没有可选择');
      console.log(`关联验证: ${ok ? '✓ 正确绑定到订单明细表' : '✗ 可能未成功'}`);
      if (!ok) {
        // 输出关联表相关文本
        const assocIdx = text.indexOf('关联表');
        if (assocIdx >= 0) {
          console.log(`属性面板:\n${text.substring(assocIdx, assocIdx + 400)}`);
        }
      }
    }

    await page.screenshot({ path: 'screenshots/subtable-v7-final.png', fullPage: true });
    console.log('\n====== V7 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
