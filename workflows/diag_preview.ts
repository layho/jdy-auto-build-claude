/**
 * 诊断：检查预览模式 + 尝试切换视图
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
  console.log('[DIAG PREVIEW]\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // ====== 1. 进入编辑器，点预览 ======
    console.log('====== 1. 编辑器预览 ======');
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

    // 点预览按钮
    const previewBtn = page.locator('button:has-text("预览")').first();
    if (await previewBtn.count() > 0 && await previewBtn.isVisible().catch(() => false)) {
      console.log('点击预览...');
      await previewBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      const text = await readPage(page);
      console.log(`预览模式:\n${text.substring(0, 1500)}`);
      console.log(`\n子表显示: ${text.includes('订单明细') ? '✓' : '✗'}`);

      await page.screenshot({ path: 'screenshots/diag-preview.png', fullPage: true });

      // 关闭预览
      const closePreview = page.locator('button:has-text("关闭"), [class*="close"]').first();
      if (await closePreview.count() > 0) await closePreview.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // ====== 2. 尝试在编辑器中保存并"发布" ======
    console.log('\n====== 2. 检查发布功能 ======');

    // 检查编辑器顶部所有按钮
    const allTopBtns = await page.evaluate(() => {
      // 找编辑器顶部区域的按钮
      const topArea = document.querySelector('.form-edit-header, .editor-header, [class*="header"]');
      if (!topArea) {
        // 尝试找所有可见的非图标按钮
        return [...document.querySelectorAll('button')]
          .filter(b => {
            const text = (b.textContent || '').trim();
            return text.length > 0 && text.length < 10 && (b as HTMLElement).offsetHeight > 0;
          })
          .map(b => ({
            text: b.textContent?.trim(),
            class: b.className?.substring(0, 100),
            rect: JSON.stringify(b.getBoundingClientRect()),
          }));
      }
      return [...topArea.querySelectorAll('button')]
        .filter(b => (b as HTMLElement).offsetHeight > 0)
        .map(b => ({
          text: b.textContent?.trim(),
          class: b.className?.substring(0, 100),
        }));
    });

    console.log(`顶部按钮: ${JSON.stringify(allTopBtns)}`);

    // ====== 3. 回到录入页，尝试切换视图 ======
    console.log('\n====== 3. 录入页视图切换 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    let text = await readPage(page);
    console.log(`当前视图: ${text.includes('仅添加数据') ? '仅添加数据' : text.includes('管理全部数据') ? '管理全部数据' : '未知'}`);

    // 尝试切换视图：点击"仅添加数据"文本
    const viewToggle = page.locator('text=仅添加数据').first();
    if (await viewToggle.count() > 0 && await viewToggle.isVisible().catch(() => false)) {
      console.log('点击"仅添加数据"视图...');
      await viewToggle.click({ force: true });
      await page.waitForTimeout(1500);

      // 看是否有下拉选项
      text = await readPage(page);
      console.log(`点击后:\n${text.substring(0, 800)}`);

      // 找"管理全部数据"选项
      const manageAllView = page.locator('[class*="option"]:has-text("管理全部数据"), li:has-text("管理全部数据")').first();
      if (await manageAllView.count() > 0 && await manageAllView.isVisible().catch(() => false)) {
        await manageAllView.click({ force: true });
        console.log('✓ 切换到管理全部数据');
        await page.waitForTimeout(2000);
        await waitForStableDOM(page);

        text = await readPage(page);
        console.log(`切换后:\n${text.substring(0, 1500)}`);
        console.log(`子表显示: ${text.includes('订单明细') ? '✓' : '✗'}`);
      }
    }

    // ====== 4. 尝试直接看数据管理页面的结构 ======
    console.log('\n====== 4. 数据管理页 ======');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // 尝试新建一条数据看看表单是否显示子表
    // 先切换到管理全部数据
    await page.locator('.tree-node').filter({ hasText: '订单管理' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    // 查找是否有"新建"按钮
    const newBtn = page.locator('button:has-text("新建")').first();
    if (await newBtn.count() > 0 && await newBtn.isVisible().catch(() => false)) {
      console.log('点击新建...');
      await newBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await waitForStableDOM(page);

      text = await readPage(page);
      console.log(`新建表单:\n${text.substring(0, 1500)}`);
      console.log(`子表显示: ${text.includes('订单明细') ? '✓' : '✗'}`);
    }

    await page.screenshot({ path: 'screenshots/diag-final-state.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
