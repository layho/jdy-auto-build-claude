/**
 * 完整修复：
 * 1. 通过hover + .btn-delete 删除重复的关联客户字段
 * 2. 配置选择数据→产品信息
 * 3. 添加关联子表→订单明细表
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

async function saveForm(page: Page): Promise<void> {
  await page.locator('button:has-text("保存")').first().click({ force: true });
  console.log('  ✓ 已保存');
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
}

async function main() {
  console.log('[COMPLETE FIX] 完整修复\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入编辑器
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const formEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await formEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await formEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // ====== 列出当前字段 ======
    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        const btn = el.querySelector('.data-select-btn');
        const btnText = btn?.textContent?.trim() || '';
        const isDisabled = btn?.hasAttribute('disabled') || false;
        return { label, btnText, isDisabled };
      })
    );
    console.log(`====== 当前字段 (${fields.length}个) ======`);
    fields.forEach((f, i) => console.log(`  [${i}] "${f.label}" btn="${f.btnText}" disabled=${f.isDisabled}`));

    // ====== 1. 删除重复的未配置关联客户字段 ======
    console.log('\n====== 1. 删除重复字段 ======');
    for (let attempt = 0; attempt < 3; attempt++) {
      // 重新获取字段列表（索引可能变化）
      const delTargets = await page.$$eval('.fx-field-layout.field', els => {
        const targets: number[] = [];
        els.forEach((el, i) => {
          const btn = el.querySelector('.data-select-btn');
          const btnText = btn?.textContent?.trim() || '';
          const isDisabled = btn?.hasAttribute('disabled') || false;
          // 找未配置的关联客户（"在右侧设置关联"且disabled）
          if (btnText.includes('在右侧设置关联') && isDisabled) {
            targets.push(i);
          }
        });
        return targets;
      });

      if (delTargets.length === 0) {
        console.log('  没有需要删除的重复字段');
        break;
      }

      console.log(`  找到 ${delTargets.length} 个重复字段: [${delTargets.join(', ')}]`);

      // 从后往前删除
      for (const idx of delTargets.reverse()) {
        const fieldEl = page.locator('.fx-field-layout.field').nth(idx);
        const fieldName = await fieldEl.locator('.field-name').innerText().catch(() => '?');
        console.log(`  删除 [${idx}] "${fieldName}"...`);

        // 先点击组件选中它，删除按钮才会出现
        await fieldEl.click({ force: true });
        await page.waitForTimeout(600);

        // 找删除按钮 .btn-delete.btn-trash
        const deleteBtn = fieldEl.locator('.btn-delete.btn-trash, i[title="删除"]').first();
        if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
          await deleteBtn.click({ force: true });
          console.log('    ✓ 点击删除');
          await page.waitForTimeout(1000);
        } else {
          // 尝试用 force click
          console.log('    删除按钮不可见，尝试force...');
          await deleteBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
        }

        // 处理可能的确认弹窗
        const alertBtn = page.locator('[class*="alert"] button:has-text("确定"), [class*="alert"] button:has-text("删除")').last();
        if (await alertBtn.count() > 0 && await alertBtn.isVisible().catch(() => false)) {
          await alertBtn.click({ force: true });
          console.log('    ✓ 确认删除');
          await page.waitForTimeout(1000);
        }
      }

      if (delTargets.length > 0) {
        await page.waitForTimeout(500);
      }
    }

    // 保存
    await saveForm(page);

    // ====== 重新列出字段 ======
    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        const btn = el.querySelector('.data-select-btn');
        const btnText = btn?.textContent?.trim() || '';
        const isDisabled = btn?.hasAttribute('disabled') || false;
        return { label, btnText, isDisabled };
      })
    );
    console.log(`\n====== 清理后字段 (${fields.length}个) ======`);
    fields.forEach((f, i) => console.log(`  [${i}] "${f.label}" btn="${f.btnText}" disabled=${f.isDisabled}`));

    // ====== 2. 配置选择数据 → 产品信息 ======
    console.log('\n====== 2. 配置选择数据 ======');
    let text = await readPage(page);

    // 找选择数据字段
    const chooseFields = await page.$$eval('.fx-field-layout.field', els => {
      const targets: number[] = [];
      els.forEach((el, i) => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        const btn = el.querySelector('.data-select-btn');
        const btnText = btn?.textContent?.trim() || '';
        if (label.includes('选择') || btnText.includes('选择数据')) {
          targets.push(i);
        }
      });
      return targets;
    });

    if (chooseFields.length > 0) {
      console.log(`  找到选择数据字段: index ${chooseFields[0]}`);
      const chooseField = page.locator('.fx-field-layout.field').nth(chooseFields[0]);
      await chooseField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      // 找数据源相关的dropdown
      const allDDs = page.locator('.x-biz-dropdown-label');
      const ddCount = await allDDs.count();
      console.log(`  属性面板中dropdown数量: ${ddCount}`);

      for (let i = 0; i < ddCount; i++) {
        const dd = allDDs.nth(i);
        const ddVisible = await dd.isVisible().catch(() => false);
        const ddText = await dd.innerText().catch(() => '');
        console.log(`    [${i}] visible=${ddVisible} text="${ddText?.substring(0, 40)}"`);
      }

      // 找空dropdown（可能包含placeholder或没有文字）
      for (let i = 0; i < ddCount; i++) {
        const dd = allDDs.nth(i);
        const ddText = await dd.innerText().catch(() => '');
        const ddVisible = await dd.isVisible().catch(() => false);
        if (!ddText.trim() && ddVisible) {
          console.log(`  点击空dropdown[${i}]...`);
          await dd.click({ force: true });
          await page.waitForTimeout(1000);

          // 选择"产品信息"
          const productOpt = page.locator('[class*="option"]:has-text("产品信息")').first();
          if (await productOpt.count() > 0 && await productOpt.isVisible().catch(() => false)) {
            await productOpt.click({ force: true });
            console.log('  ✓ 已选择产品信息');
          } else {
            // 尝试文本点击
            await page.locator('text=产品信息').last().click({ force: true }).catch(() => {});
            console.log('  尝试文本点击产品信息');
          }
          await page.waitForTimeout(500);
          break;
        }
      }
    } else {
      console.log('  ⚠ 未找到选择数据字段');
    }

    await saveForm(page);

    // ====== 3. 添加关联子表 ======
    console.log('\n====== 3. 添加关联子表 ======');
    text = await readPage(page);

    // 检查是否已有关联子表
    const subFields = await page.$$eval('.fx-field-layout.field', els => {
      const targets: number[] = [];
      els.forEach((el, i) => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        const btn = el.querySelector('.data-select-btn');
        const btnText = btn?.textContent?.trim() || '';
        if (label.includes('明细') || label.includes('子表') || btnText.includes('子表')) {
          targets.push(i);
        }
      });
      return targets;
    });

    if (subFields.length === 0) {
      console.log('  添加关联子表...');
      await page.locator('li.form-edit-widget-label:has-text("关联子表")').first().click({ force: true });
      await page.waitForTimeout(1500);

      // 设标题
      const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
      await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
      await titleInput.fill('订单明细').catch(() => {});
      await page.waitForTimeout(400);

      // 点"从空白新建"
      const createBlankBtn = page.locator('text=从空白新建').first();
      if (await createBlankBtn.count() > 0 && await createBlankBtn.isVisible().catch(() => false)) {
        await createBlankBtn.click({ force: true });
        await page.waitForTimeout(1000);

        // 输入关联表名
        const formNameInput = page.locator('[class*="dialog"] input.input-inner').first();
        await formNameInput.click({ clickCount: 3, force: true });
        await formNameInput.fill('订单明细表');
        await page.waitForTimeout(300);

        // 点"设计关联表"
        const designBtn = page.locator('button:has-text("设计关联表")').first();
        if (await designBtn.count() > 0) {
          await designBtn.click({ force: true });
          console.log('  ✓ 创建关联表: 订单明细表');
          await page.waitForTimeout(3000);
        }
      } else {
        // 如果"从空白新建"不可见，可能已经有下拉选项，选"订单明细表"
        console.log('  尝试选择已有订单明细表...');
        const existingOpt = page.locator('[class*="option"]:has-text("订单明细表")').first();
        if (await existingOpt.count() > 0 && await existingOpt.isVisible().catch(() => false)) {
          await existingOpt.click({ force: true });
          console.log('  ✓ 已绑定订单明细表');
        }
      }
    } else {
      console.log(`  关联子表已存在: index ${subFields[0]}`);
    }

    await saveForm(page);

    // ====== 最终验证 ======
    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const label = el.querySelector('.field-name')?.textContent?.trim() || '';
        const btn = el.querySelector('.data-select-btn');
        const btnText = btn?.textContent?.trim() || '';
        const isDisabled = btn?.hasAttribute('disabled') || false;
        return { label, btnText, isDisabled };
      })
    );
    console.log(`\n====== 最终字段 (${fields.length}个) ======`);
    fields.forEach((f, i) => console.log(`  [${i}] "${f.label}" btn="${f.btnText}" disabled=${f.isDisabled}`));

    text = await readPage(page);
    console.log(`\n====== 验证 ======`);
    console.log(`  订单编号: ${text.includes('订单编号') ? '✓' : '✗'}`);
    console.log(`  下单日期: ${text.includes('下单日期') ? '✓' : '✗'}`);
    console.log(`  关联客户: ${text.includes('关联客户') ? '✓' : '✗'}`);
    console.log(`  客户信息: ${text.includes('客户信息') ? '✓' : '✗'}`);
    console.log(`  订单明细: ${text.includes('订单明细') ? '✓' : '✗'}`);
    console.log(`  选择产品: ${text.includes('选择产品') ? '✓' : '✗'}`);
    console.log(`  产品信息: ${text.includes('产品信息') ? '✓' : '✗'}`);

    const duplicateCount = fields.filter(f => f.isDisabled && f.btnText.includes('在右侧设置关联')).length;
    console.log(`  重复字段: ${duplicateCount === 0 ? '✓ 已清理' : '✗ 仍有' + duplicateCount + '个'}`);

    await page.screenshot({ path: 'screenshots/complete-fix-done.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
