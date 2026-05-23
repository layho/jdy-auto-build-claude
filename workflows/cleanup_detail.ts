/**
 * 清理订单明细表：
 * 1. 删除自动生成的"订单管理"关联数据字段
 * 2. 设置齐妍娜的权限为管理全部数据
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
  console.log('[CLEANUP DETAIL FORM]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2500);

    // ====== 1. 删除订单明细表的"订单管理"字段 ======
    console.log('====== 1. 清理字段 ======');
    const detailEntry = page.locator('.tree-node').filter({ hasText: '订单明细表' }).first();
    await detailEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await detailEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    let fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`当前字段: ${fields.join(' | ')}`);

    // 删除"订单管理"字段
    const orderMgmtIdx = fields.indexOf('订单管理');
    if (orderMgmtIdx >= 0) {
      console.log('删除"订单管理"字段...');
      const fieldEl = page.locator('.fx-field-layout.field').nth(orderMgmtIdx);
      await fieldEl.click({ force: true });
      await page.waitForTimeout(600);
      const deleteBtn = fieldEl.locator('.btn-delete.btn-trash').first();
      if (await deleteBtn.count() > 0 && await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click({ force: true });
        await page.waitForTimeout(800);
        const confirmBtn = page.locator('[class*="alert"] button:has-text("确定")').last();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ force: true });
          await page.waitForTimeout(1000);
        }
      }
      console.log('✓ 已删除');
    }

    // 保存
    await page.locator('button:has-text("保存")').first().click({ force: true });
    await page.waitForTimeout(2000);

    fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`清理后字段: ${fields.join(' | ')}`);

    // ====== 2. 设置权限 ======
    console.log('\n====== 2. 设置权限 ======');

    // 使用更准确的方式找到并点击"表单发布"
    const tabItems = await page.$$eval('.tab-header-item.form-tab-item', els =>
      els.map(el => el.textContent?.trim())
    );
    console.log(`编辑器tabs: ${tabItems.join(' | ')}`);

    // 尝试点击表单发布
    const publishTab = page.locator('.tab-header-item.form-tab-item:has-text("表单发布")').first();
    if (await publishTab.count() > 0 && await publishTab.isVisible().catch(() => false)) {
      await publishTab.click({ force: true });
      console.log('✓ 已点击表单发布');
      await page.waitForTimeout(2000);
      await waitForStableDOM(page);
    } else {
      // 尝试备选选择器
      const altPublishTab = page.locator('.tab-header-item:has-text("表单发布")').first();
      if (await altPublishTab.count() > 0) {
        await altPublishTab.click({ force: true });
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);
      }
    }

    let text = await readPage(page);
    console.log(`\n表单发布内容:\n${text.substring(0, 1500)}`);
    await page.screenshot({ path: 'screenshots/detail-publish2.png', fullPage: true });

    // 查找已有的权限组成员
    const hasMember = text.includes('齐妍娜');
    console.log(`已有齐妍娜: ${hasMember}`);

    if (!hasMember) {
      // 添加成员
      // 查找"添加成员"按钮 - 可能在 .member-manage 区域
      const addBtns = await page.$$eval('button, span, a', els =>
        els.filter(el => {
          const txt = (el.textContent || '').trim();
          return (txt === '添加成员' || txt === '添加') && (el as HTMLElement).offsetHeight > 0;
        }).map(el => ({
          tag: el.tagName,
          class: (el as HTMLElement).className?.substring(0, 100),
          text: (el.textContent || '').trim(),
        }))
      );
      console.log(`"添加成员"元素: ${JSON.stringify(addBtns)}`);

      // 尝试点击
      const addBtn = page.locator('button:has-text("添加成员")').first();
      if (await addBtn.count() > 0 && await addBtn.isVisible().catch(() => false)) {
        await addBtn.click({ force: true });
      } else {
        const addSpan = page.locator('span:has-text("添加成员")').first();
        if (await addSpan.count() > 0) await addSpan.click({ force: true });
      }
      await page.waitForTimeout(1500);

      text = await readPage(page);
      console.log(`添加成员弹窗:\n${text.substring(0, 800)}`);

      // 搜索齐妍娜
      const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="请输入名称"]').first();
      if (await searchInput.count() > 0 && await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('齐妍娜');
        await page.waitForTimeout(1500);
      }

      await page.screenshot({ path: 'screenshots/detail-add-member.png', fullPage: true });

      // 选择齐妍娜
      const qinaCheckbox = page.locator('input[type="checkbox"]').first();
      if (await qinaCheckbox.count() > 0 && await qinaCheckbox.isVisible().catch(() => false)) {
        await qinaCheckbox.click({ force: true });
        await page.waitForTimeout(500);
      }

      // 确定
      const confirmBtn = page.locator('button:has-text("确定")').last();
      if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click({ force: true });
        console.log('✓ 成员已添加');
        await page.waitForTimeout(1500);
      }
    }

    // 修改权限级别为管理全部数据
    text = await readPage(page);
    console.log(`\n当前权限页:\n${text.substring(0, 1000)}`);

    // 查找权限标签并点击
    const permEls = await page.$$eval('*', els =>
      els.filter(el => {
        const txt = (el.textContent || '').trim();
        return ['仅添加数据', '添加并管理本人数据', '添加并查看全部数据', '管理全部数据', '查看全部数据'].includes(txt) &&
          (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetHeight < 50;
      }).map(el => ({
        tag: el.tagName,
        class: (el as HTMLElement).className?.substring(0, 120),
        text: (el.textContent || '').trim(),
        rect: JSON.stringify((el as HTMLElement).getBoundingClientRect()),
      }))
    );
    console.log(`权限标签元素: ${JSON.stringify(permEls)}`);

    // 如果找到"管理全部数据"之外的权限标签，点击修改
    for (const pEl of permEls) {
      if (pEl.text !== '管理全部数据') {
        console.log(`点击 "${pEl.text}" 打开下拉...`);
        const target = page.getByText(pEl.text, { exact: true }).first();
        if (await target.count() > 0 && await target.isVisible().catch(() => false)) {
          await target.click({ force: true });
          await page.waitForTimeout(1000);

          // 选管理全部数据
          const manageAll = page.locator('[class*="option"]:has-text("管理全部数据"), li:has-text("管理全部数据"), div:has-text("管理全部数据")').first();
          if (await manageAll.count() > 0 && await manageAll.isVisible().catch(() => false)) {
            await manageAll.click({ force: true });
            console.log('✓ 已选择管理全部数据');
            await page.waitForTimeout(500);

            // 确认
            const confirmBtn2 = page.locator('button:has-text("确定")').last();
            if (await confirmBtn2.count() > 0 && await confirmBtn2.isVisible().catch(() => false)) {
              await confirmBtn2.click({ force: true });
              await page.waitForTimeout(1000);
            }
          }
        }
        break;
      }
    }

    await page.screenshot({ path: 'screenshots/detail-final.png', fullPage: true });

    // ====== 3. 验证订单明细表的显示字段配置 ======
    console.log('\n====== 3. 验证订单管理的关联子表 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    const orderEntry = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    await orderEntry.hover({ force: true });
    await page.waitForTimeout(600);
    await orderEntry.locator('.entry-set-icon').click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('li:has-text("编辑")').last().click({ force: true });
    await page.waitForURL('**/edit**', { timeout: 10000 });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    const orderFields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => el.querySelector('.field-name')?.textContent?.trim() || '')
    );
    console.log(`订单管理字段: ${orderFields.join(' | ')}`);

    // 检查关联子表
    if (orderFields.includes('订单明细')) {
      const subField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
      await subField.click({ force: true });
      await page.waitForTimeout(1500);
      text = await readPage(page);

      const ok = text.includes('订单明细表') && !text.includes('已删除') && !text.includes('关联不存在');
      console.log(`关联验证: ${ok ? '✓ 正确' : '✗ 有问题'}`);

      // 显示字段配置
      const showIdx = text.indexOf('显示字段');
      if (showIdx >= 0) {
        console.log(`\n显示字段配置:\n${text.substring(showIdx, showIdx + 300)}`);
      }
    }

    console.log('\n====== 清理完成 ======');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
