/**
 * 最终修复：
 * 1. 列出所有字段
 * 2. 删除未配置的重复字段
 * 3. 配置选择数据→产品信息
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
  console.log('[FINAL FIX] 最终修复\n');
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

    // 列出所有字段
    const fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80);
        const cls = (el as HTMLElement).className;
        return { text, class: cls.substring(0, 80) };
      })
    );
    console.log(`====== 表单画布字段 (${fields.length}个) ======`);
    fields.forEach((f, i) => console.log(`  [${i}] "${f.text}"`));

    // 删除"在右侧设置关联"的未配置字段
    console.log('\n====== 删除未配置字段 ======');
    for (let attempt = 0; attempt < 3; attempt++) {
      const unconfiguredFields = await page.$$eval('.fx-field-layout.field', els => {
        const result: number[] = [];
        els.forEach((el, i) => {
          const text = (el.textContent || '');
          if (text.includes('在右侧设置关联') || text.includes('配置有误')) {
            result.push(i);
          }
        });
        return result;
      });

      if (unconfiguredFields.length === 0) {
        console.log('  没有未配置字段');
        break;
      }

      console.log(`  发现 ${unconfiguredFields.length} 个未配置字段`);
      for (const idx of unconfiguredFields.reverse()) {
        const fieldEl = page.locator('.fx-field-layout.field').nth(idx);
        console.log(`  删除 [${idx}]...`);

        // 点击字段选中
        await fieldEl.click({ force: true });
        await page.waitForTimeout(300);

        // 尝试按 Delete 键
        await page.keyboard.press('Delete');
        await page.waitForTimeout(1000);

        // 如果Delete不生效，尝试Backspace
        const stillExists = await fieldEl.count().catch(() => 0);
        if (stillExists > 0) {
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(1000);
        }

        // 检查是否出现确认对话框
        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定"), [class*="alert"] button:has-text("删除")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          console.log('    ✓ 确认删除');
          await page.waitForTimeout(1000);
        }
      }

      if (unconfiguredFields.length > 0) {
        await page.waitForTimeout(1000);
      }
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('  ✓ 保存');
    await page.waitForTimeout(2000);

    // 重新列出字段
    const fieldsAfter = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80))
    );
    console.log(`\n====== 清理后字段 ======`);
    fieldsAfter.forEach((f, i) => console.log(`  [${i}] "${f}"`));

    // ====== 配置选择数据 ======
    console.log('\n====== 配置选择数据 ======');
    let text = await readPage(page);

    // 先检查画布上是否已有选择数据字段
    let chooseField = page.locator('.fx-field-layout.field').filter({ hasText: '选择' }).first();
    if (await chooseField.count() === 0) {
      // 添加选择数据字段
      console.log('  画布上没有选择数据字段，从左侧添加...');
      await page.locator('li.form-edit-widget-label:has-text("选择数据")').first().click({ force: true });
      await page.waitForTimeout(1500);

      // 设置标题为"选择产品"
      const titleInput = page.locator('.fx-field-title-input input.input-inner').last();
      await titleInput.click({ clickCount: 3, force: true }).catch(() => {});
      await titleInput.fill('选择产品').catch(() => {});
      await page.waitForTimeout(500);

      chooseField = page.locator('.fx-field-layout.field').filter({ hasText: '选择' }).first();
    }

    if (await chooseField.count() > 0) {
      const chooseText = await chooseField.innerText().catch(() => '');
      console.log(`  选择字段: "${chooseText?.substring(0, 40)}"`);
      await chooseField.click({ force: true });
      await page.waitForTimeout(1500);

      text = await readPage(page);
      // 检查属性面板中是否有数据源下拉
      const dataSourceLabel = page.locator('.x-biz-dropdown-label').filter({ hasText: '' }).first();
      // 查找所有可见的dropdown
      const allDDs = page.locator('.x-biz-dropdown-label');
      const ddCount = await allDDs.count();
      console.log(`  属性面板中dropdown数量: ${ddCount}`);

      for (let i = 0; i < ddCount; i++) {
        const dd = allDDs.nth(i);
        const ddVisible = await dd.isVisible().catch(() => false);
        const ddText = await dd.innerText().catch(() => '');
        const parentText = await dd.locator('..').innerText().catch(() => '');
        console.log(`    [${i}] visible=${ddVisible} text="${ddText?.substring(0, 30)}" parent="${parentText?.substring(0, 50)}"`);
      }

      // 点有 placeholder 的空下拉
      const emptyDD = page.locator('.dropdown-label-placeholder').first();
      if (await emptyDD.count() > 0 && await emptyDD.isVisible().catch(() => false)) {
        await emptyDD.locator('..').click({ force: true });
        console.log('  点击空下拉...');
        await page.waitForTimeout(1000);

        text = await readPage(page);
        // 找弹出选项中的"产品信息"
        const productOpt = page.locator('[class*="option"]:has-text("产品信息")').first();
        if (await productOpt.count() > 0 && await productOpt.isVisible().catch(() => false)) {
          await productOpt.click({ force: true });
          console.log('  ✓ 已选择产品信息');
          await page.waitForTimeout(500);
        } else {
          console.log('  ⚠ 未找到产品信息选项，尝试文本点击...');
          await page.locator('text=产品信息').last().click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
        }
      } else {
        // 试试点第一个可见的空dropdown
        for (let i = 0; i < ddCount; i++) {
          const dd = allDDs.nth(i);
          const ddText = await dd.innerText().catch(() => '');
          if (!ddText.trim() && await dd.isVisible().catch(() => false)) {
            await dd.click({ force: true });
            console.log(`  点击dropdown[${i}]...`);
            await page.waitForTimeout(1000);
            break;
          }
        }
      }
    } else {
      console.log('  ⚠ 无法找到选择数据字段');
    }

    // 最终保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    console.log('\n  ✓ 最终保存');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/final-fix-done.png', fullPage: true });

    // 最终总结
    text = await readPage(page);
    const finalFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 50))
    );

    console.log('\n====== 最终结果 ======');
    console.log(`字段列表: ${JSON.stringify(finalFields)}`);
    console.log(`关联数据(客户信息): ${text.includes('客户信息') ? '✓' : '✗'}`);
    console.log(`选择数据(产品信息): ${text.includes('产品信息') ? '✓' : '✗'}`);
    if (text.includes('已和') && text.includes('建立关联')) {
      const match = text.match(/已和(.+?)建立关联/g);
      console.log(`关联: ${match?.join(', ')}`);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
