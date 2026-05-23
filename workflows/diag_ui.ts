/**
 * 诊断UI状态：菜单选项、按钮等
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

async function goHome(page: Page): Promise<void> {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page);
  await page.waitForTimeout(2500);
}

async function main() {
  console.log('[DIAG UI]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await goHome(page);

    let text = await readPage(page);
    console.log('====== 应用首页 ======');
    console.log(text.substring(0, 800));

    // 列出所有tree-node和它们的操作菜单
    const treeNodes = await page.$$eval('.tree-node', els =>
      els.map(el => el.textContent?.trim().substring(0, 40))
    );
    console.log(`\nTree nodes: ${treeNodes.join(' | ')}`);

    // 点击第一个tree-node的entry-set-icon看看菜单有哪些选项
    const firstNode = page.locator('.tree-node').filter({ hasText: '订单管理' }).first();
    if (await firstNode.count() > 0) {
      console.log('\n====== 订单管理菜单选项 ======');
      await firstNode.hover({ force: true });
      await page.waitForTimeout(600);
      await firstNode.locator('.entry-set-icon').click({ force: true });
      await page.waitForTimeout(800);

      // 读取菜单
      const menuItems = await page.$$eval('li', els =>
        els.filter(el => el.offsetHeight > 0).map(el => el.textContent?.trim().substring(0, 40))
      );
      console.log(`可见菜单项: ${menuItems.join(' | ')}`);

      // 关闭菜单
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 点击进入订单管理的数据视图
    console.log('\n====== 订单管理数据视图 ======');
    await firstNode.click({ force: true });
    await page.waitForTimeout(3000);
    await waitForStableDOM(page);

    text = await readPage(page);
    console.log(text.substring(0, 600));

    // 找所有按钮
    const buttons = await page.$$eval('button', els =>
      els.filter(el => el.offsetHeight > 0).map(el => ({
        text: (el.textContent || '').trim().substring(0, 40),
        class: ((el as HTMLElement).className || '').substring(0, 60),
      }))
    );
    console.log(`\n可见按钮:`);
    buttons.forEach((b, i) => console.log(`  [${i}] "${b.text}" class="${b.class}"`));

    // 如果数据列表有内容，看看数据结构
    if (text.includes('关联客户') || text.includes('订单编号')) {
      console.log('\n有数据列头');
    }

    // 查找添加数据的入口
    const addSelectors = [
      'button:has-text("新建")',
      'button:has-text("添加")',
      '[class*="add-btn"]',
      '[class*="add"] button',
      'button:has-text("添加数据")',
      'text=新建',
    ];
    for (const sel of addSelectors) {
      const el = page.locator(sel).first();
      const count = await el.count();
      const visible = count > 0 ? await el.isVisible().catch(() => false) : false;
      if (count > 0) {
        const elText = await el.innerText().catch(() => '');
        console.log(`选择器 "${sel}": count=${count} visible=${visible} text="${elText}"`);
      }
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
