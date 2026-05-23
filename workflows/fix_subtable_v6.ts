/**
 * 修复关联子表 V6：
 * 1. 诊断当前状态
 * 2. 如果字段已损坏，删除并重新添加
 * 3. 使用"绑定已有表单"→找到并点击"选择表单"→选订单明细表
 * 4. 关键：用 page.evaluate 找到"选择表单"的可点击元素
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
  console.log('[FIX SUBTABLE V6]\n');
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

    // ====== 1. 诊断当前状态 ======
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    const subIdx = fields.indexOf('订单明细');
    if (subIdx >= 0) {
      console.log(`\n订单明细字段存在 [${subIdx}]，检查关联状态...`);
      const subField = page.locator('.fx-field-layout.field').nth(subIdx);
      await subField.click({ force: true });
      await page.waitForTimeout(1500);

      let text = await readPage(page);
      const isBroken = text.includes('已删除') || text.includes('关联不存在') || text.includes('没有可选择的');
      console.log(`关联状态: ${isBroken ? '✗ 已损坏' : '✓ 正常'}`);

      if (isBroken) {
        // 删除损坏字段
        console.log('删除损坏的订单明细字段...');
        const deleteBtn = subField.locator('.btn-delete.btn-trash, i[title="删除"]').first();
        if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
          await deleteBtn.click({ force: true });
          await page.waitForTimeout(1000);

          const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
          if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.click({ force: true });
            await page.waitForTimeout(1000);
          }
          console.log('✓ 已删除');
        }

        // 保存
        await page.locator('button:has-text("保存")').first().click({ force: true });
        console.log('✓ 已保存');
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
        await page.waitForTimeout(1000);
      } else {
        console.log('关联子表正常，无需修复');
        await page.screenshot({ path: 'screenshots/subtable-v6-ok.png', fullPage: true });
        return;
      }
    }

    // ====== 2. 重新添加关联子表 ======
    console.log('\n====== 2. 添加关联子表 ======');
    await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
    await page.waitForTimeout(1500);

    // 设标题
    const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
    await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
    await titleInput.fill('订单明细');
    await page.waitForTimeout(400);

    let text = await readPage(page);
    console.log(`Dialog可见: ${text.includes('添加关联子表') ? '✓' : '✗'}`);

    // ====== 3. 选择"绑定已有表单" ======
    const bindExisting = page.getByText('绑定已有表单').first();
    if (await bindExisting.count() > 0 && await bindExisting.isVisible().catch(() => false)) {
      await bindExisting.click({ force: true });
      console.log('✓ 已选择绑定已有表单');
      await page.waitForTimeout(1500);
    } else {
      console.log('⚠ 没找到"绑定已有表单"选项');
    }

    text = await readPage(page);
    console.log(`\n选择绑定已有表单后的dialog:\n${text.substring(text.indexOf('添加关联子表'), text.indexOf('添加关联子表') + 600)}`);

    await page.screenshot({ path: 'screenshots/subtable-v6-bind-existing.png', fullPage: true });

    // ====== 4. 找到"选择表单"的可点击元素 ======
    // 用 evaluate 深入查找
    const selectFormInfo = await page.evaluate(() => {
      const results: any[] = [];
      // 搜索所有包含"选择表单"文本的元素
      const allEls = document.querySelectorAll('*');
      allEls.forEach(el => {
        const txt = (el.textContent || '').trim();
        if (txt === '选择表单' || txt.includes('选择表单')) {
          const htmlEl = el as HTMLElement;
          const rect = htmlEl.getBoundingClientRect();
          const style = window.getComputedStyle(htmlEl);
          results.push({
            tag: el.tagName,
            class: htmlEl.className?.substring(0, 150),
            id: htmlEl.id,
            text: txt.substring(0, 80),
            visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            // Check parent chain
            parentTag: el.parentElement?.tagName,
            parentClass: el.parentElement?.className?.substring(0, 150),
            grandparentTag: el.parentElement?.parentElement?.tagName,
            grandparentClass: el.parentElement?.parentElement?.className?.substring(0, 150),
            // Check if there's a clickable ancestor
            clickableAncestor: (() => {
              let p = el.parentElement;
              while (p) {
                const pStyle = window.getComputedStyle(p);
                const pRect = p.getBoundingClientRect();
                if (pRect.width > 0 && pRect.height > 0 && pStyle.cursor === 'pointer') {
                  return { tag: p.tagName, class: p.className?.substring(0, 150) };
                }
                p = p.parentElement;
              }
              return null;
            })(),
          });
        }
      });
      return results;
    });

    console.log(`\n"选择表单"相关元素: ${selectFormInfo.length}个`);
    selectFormInfo.forEach((info, i) => {
      console.log(`  [${i}] <${info.tag}> class="${info.class}" visible=${info.visible} rect=${JSON.stringify(info.rect)}`);
      console.log(`       parent: <${info.parentTag}> class="${info.parentClass}"`);
      console.log(`       clickableAncestor: ${JSON.stringify(info.clickableAncestor)}`);
    });

    // 尝试点击"选择表单" - 优先找可见的
    let clickedSelect = false;
    for (const selector of [
      page.locator('button:has-text("选择表单")').first(),
      page.locator('span:has-text("选择表单")').first(),
      page.locator('div:has-text("选择表单")').first(),
      page.getByText('选择表单').first(),
    ]) {
      if (await selector.count() > 0 && await selector.isVisible().catch(() => false)) {
        console.log(`\n尝试点击: ${selector}`);
        await selector.click({ force: true });
        clickedSelect = true;
        break;
      }
    }

    if (!clickedSelect) {
      // 尝试找 .x-biz-dropdown 或其他下拉组件
      console.log('\n尝试找下拉组件...');
      const dropdowns = page.locator('.x-biz-dropdown-label, .fx-select-trigger, [class*="select-form"]');
      const ddCount = await dropdowns.count();
      console.log(`下拉组件: ${ddCount}个`);
      for (let i = 0; i < ddCount; i++) {
        const dd = dropdowns.nth(i);
        const ddText = await dd.innerText().catch(() => '');
        const ddVisible = await dd.isVisible().catch(() => false);
        if (ddVisible) {
          console.log(`  [${i}] "${ddText.substring(0, 60)}"`);
          await dd.click({ force: true });
          clickedSelect = true;
          break;
        }
      }
    }

    if (clickedSelect) {
      await page.waitForTimeout(2000);
      text = await readPage(page);
      console.log(`\n点击选择表单后:\n${text.substring(0, 1500)}`);
      await page.screenshot({ path: 'screenshots/subtable-v6-form-picker.png', fullPage: true });

      // ====== 5. 在表单选择器中选订单明细表 ======
      // 搜索"订单明细表"的所有可见元素
      const detailInfo = await page.evaluate(() => {
        const results: any[] = [];
        document.querySelectorAll('*').forEach(el => {
          const txt = (el.textContent || '').trim();
          if (txt === '订单明细表') {
            const htmlEl = el as HTMLElement;
            const rect = htmlEl.getBoundingClientRect();
            results.push({
              tag: el.tagName,
              class: htmlEl.className?.substring(0, 150),
              visible: rect.width > 0 && rect.height > 0,
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            });
          }
        });
        return results;
      });

      console.log(`\n"订单明细表"可见元素: ${detailInfo.length}个`);
      detailInfo.forEach((d, i) => console.log(`  [${i}] <${d.tag}> class="${d.class}" visible=${d.visible} rect=${JSON.stringify(d.rect)}`));

      // 尝试点击
      const detailOption = page.getByText('订单明细表', { exact: true }).first();
      if (await detailOption.count() > 0 && await detailOption.isVisible().catch(() => false)) {
        await detailOption.click({ force: true });
        console.log('✓ 已点击订单明细表');
        await page.waitForTimeout(500);
      } else {
        // 可能是在列表中，尝试点行
        const detailRow = page.locator('tr:has-text("订单明细表"), [class*="row"]:has-text("订单明细表"), li:has-text("订单明细表")').first();
        if (await detailRow.count() > 0 && await detailRow.isVisible().catch(() => false)) {
          await detailRow.click({ force: true });
          console.log('✓ 已点击订单明细表行');
          await page.waitForTimeout(500);
        }
      }

      // 确认（可能需要多点几次确定）
      for (let i = 0; i < 3; i++) {
        const confirmBtn = page.locator('button:has-text("确定")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          console.log(`  确定 [${i}]`);
          await page.waitForTimeout(1500);
        } else {
          break;
        }
      }
    } else {
      console.log('⚠ 未能触发选择表单');
    }

    // ====== 6. 保存 ======
    text = await readPage(page);
    console.log(`\n保存前状态:\n${text.substring(0, 800)}`);

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
      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确绑定到订单明细表' : '✗ 可能未成功'}`);
      if (!ok) {
        console.log(`属性面板关联表部分:\n${text.substring(text.indexOf('关联表'), text.indexOf('关联表') + 300)}`);
      }
    }

    await page.screenshot({ path: 'screenshots/subtable-v6-final.png', fullPage: true });
    console.log('\n====== V6 完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
