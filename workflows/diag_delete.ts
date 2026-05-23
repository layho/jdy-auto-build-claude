/**
 * 诊断：hover字段后出现的删除按钮
 * 用户提示：编辑模式下鼠标悬停在组件上时删除按钮就会出现
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
  console.log('[DIAG HOVER DELETE] 悬停找删除按钮\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

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

    // 列出字段
    const fields = await page.$$eval('.fx-field-layout.field', els =>
      els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 80))
    );
    console.log(`字段 (${fields.length}个):`);
    fields.forEach((f, i) => console.log(`  [${i}] "${f}"`));

    // 找出第一个未配置的关联客户字段 (index 1)
    const target = page.locator('.fx-field-layout.field').nth(1); // 第2个字段，未配置

    console.log('\n====== 悬停前 ======');
    let preBtns = await page.$$eval('.fx-field-layout.field button, .fx-field-layout.field i, .fx-field-layout.field [class*="icon"], .fx-field-layout.field [class*="operate"]', els =>
      els.filter(el => (el as HTMLElement).offsetHeight > 0).map(el => ({
        tag: el.tagName,
        class: ((el as HTMLElement).className || '').toString().substring(0, 80),
        text: (el.textContent || '').trim().substring(0, 30),
      }))
    );
    console.log(`字段内可见按钮: ${preBtns.length}`);
    preBtns.forEach((b: any, i: number) => console.log(`  [${i}] ${b.tag} "${b.text}" class="${b.class}"`));

    // 悬停在目标字段上
    console.log('\n====== 悬停后 ======');
    await target.hover({ force: true });
    await page.waitForTimeout(1000);

    // 查找整个页面中所有可见的按钮和图标，特别是新出现的
    let postBtns = await page.$$eval('button, i, [class*="icon"], [class*="operate"], [class*="delete"], [class*="remove"]', els =>
      els.filter(el => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.left > 0;
      }).map(el => ({
        tag: el.tagName,
        class: ((el as HTMLElement).className || '').toString().substring(0, 100),
        text: (el.textContent || '').trim().substring(0, 50),
        rect: `${Math.round((el as HTMLElement).getBoundingClientRect().top)},${Math.round((el as HTMLElement).getBoundingClientRect().left)}`,
      }))
    );

    // 过滤出包含 delete/remove/close/del 的
    const deleteBtns = postBtns.filter((b: any) =>
      b.class.toLowerCase().includes('delete') || b.class.toLowerCase().includes('remove')
      || b.class.toLowerCase().includes('close') || b.class.toLowerCase().includes('del')
      || b.text.includes('删除') || b.text.includes('移除')
    );
    console.log(`删除相关按钮: ${deleteBtns.length}`);
    deleteBtns.forEach((b: any, i: number) => console.log(`  [${i}] ${b.tag} "${b.text}" class="${b.class}" pos=${b.rect}`));

    // 截图
    await page.screenshot({ path: 'screenshots/diag-hover-field.png', fullPage: true });

    // 查找field元素旁边的操作按钮 - 可能在field的父级或相邻元素中
    const targetHTML = await target.evaluate(el => {
      const parent = el.parentElement;
      if (!parent) return 'no parent';
      return parent.innerHTML.substring(0, 3000);
    });
    console.log(`\n字段父级HTML:\n${targetHTML}`);

    // 直接找 .fx-field-layout 内的操作区
    const fieldLayout = target.locator('..');
    const layoutHTML = await fieldLayout.evaluate(el => el.innerHTML.substring(0, 3000)).catch(() => 'error');
    console.log(`\nfield-layout HTML:\n${layoutHTML}`);

    // 最后尝试直接搜索页面上的所有button，打印class包含特殊关键词的
    console.log('\n====== 页面所有可见button ======');
    const allVisibleBtns = await page.$$eval('button', els =>
      els.filter(el => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).map(el => ({
        class: ((el as HTMLElement).className || '').toString().substring(0, 80),
        text: (el.textContent || '').trim().substring(0, 30),
        rect: `${Math.round((el as HTMLElement).getBoundingClientRect().top)},${Math.round((el as HTMLElement).getBoundingClientRect().left)}`,
      }))
    );
    console.log(`共 ${allVisibleBtns.length} 个button`);
    // 过滤有意义的
    const meaningful = allVisibleBtns.filter((b: any) => b.text || b.class.includes('icon') || b.class.includes('btn'));
    meaningful.forEach((b: any, i: number) => console.log(`  [${i}] "${b.text}" class="${b.class}" pos=${b.rect}`));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
