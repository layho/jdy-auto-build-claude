/**
 * 检查表单是否已保存/发布，确保子表配置生效
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
  console.log('[SAVE AND PUBLISH]\n');
  const wd = startWatchdog({ hardTimeoutMs: 240_000 });
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

    // 检查所有顶部按钮
    const topButtons = await page.evaluate(() => {
      return [...document.querySelectorAll('button')]
        .filter(b => (b as HTMLElement).offsetHeight > 0)
        .map(b => ({
          text: (b.textContent || '').trim().substring(0, 30),
          class: b.className?.substring(0, 120),
          rect: JSON.stringify(b.getBoundingClientRect()),
        }));
    });
    console.log(`顶部按钮: ${JSON.stringify(topButtons, null, 2)}`);

    // 查找保存和发布按钮
    const saveBtn = page.locator('button:has-text("保存")').first();
    const saveCount = await saveBtn.count();
    const saveVisible = await saveBtn.isVisible().catch(() => false);
    console.log(`\n保存按钮: ${saveCount}个, 可见=${saveVisible}`);

    if (saveVisible) {
      console.log('点击保存...');
      await saveBtn.click({ force: true });
      await page.waitForTimeout(3000);
      console.log('✓ 已保存');
    }

    // 查找发布按钮
    const publishBtn = page.locator('button:has-text("发布")').first();
    const pubVisible = await publishBtn.isVisible().catch(() => false);
    console.log(`发布按钮可见: ${pubVisible}`);

    if (pubVisible) {
      console.log('点击发布...');
      await publishBtn.click({ force: true });
      await page.waitForTimeout(2000);
      console.log('✓ 已发布');
    }

    // 检查是否有未保存的更改提示
    const pageText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\n页面状态: ${pageText.includes('发布') ? '有发布按钮' : '无发布按钮'}`);
    console.log(`已发布状态: ${pageText.includes('已发布') ? '✓' : '?'}`);

    await page.screenshot({ path: 'screenshots/save-publish.png', fullPage: true });

    // ====== 检查表单字段配置 ======
    console.log('\n====== 检查字段 ======');
    const fields = await page.evaluate(() => {
      return [...document.querySelectorAll('.fx-field-layout.field')].map(el => ({
        text: (el as HTMLElement).innerText?.trim()?.substring(0, 80),
        class: (el as HTMLElement).className?.substring(0, 200),
      }));
    });
    fields.forEach((f, i) => console.log(`  [${i}] ${f.text}`));

    // 点击订单明细字段查看配置
    const orderDetailField = page.locator('.fx-field-layout.field').filter({ hasText: '订单明细' }).first();
    if (await orderDetailField.count() > 0) {
      await orderDetailField.click({ force: true });
      await page.waitForTimeout(1500);

      // 查看右侧属性面板
      const propPanel = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('[class*="property"], [class*="config"], [class*="setting"]')]
          .filter(el => (el as HTMLElement).offsetWidth > 200);
        return panels.map(p => ({
          class: (p as HTMLElement).className?.substring(0, 200),
          text: (p as HTMLElement).innerText?.substring(0, 500),
        }));
      });
      console.log(`属性面板: ${JSON.stringify(propPanel, null, 2)}`);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
