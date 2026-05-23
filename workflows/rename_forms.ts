/**
 * 重命名三个表单：客户信息、产品信息、订单管理
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

const APP_URL = 'https://www.jiandaoyun.com/dashboard#/app/6a0aa9d82c4789aa80588d06';
const NEW_NAMES = ['客户信息', '产品信息', '订单管理'];

async function readPage(page: any) {
  return await page.locator('body').first().innerText().catch(() => '') || '';
}

async function renameOneForm(page: any, oldName: string, newName: string): Promise<boolean> {
  console.log(`\n重命名 "${oldName}" → "${newName}"`);

  // 找到 tree-node 并 hover
  const entry = page.locator('.tree-node').filter({ hasText: oldName }).first();
  if (await entry.count() === 0) {
    console.log('  未找到该表单');
    return false;
  }

  await entry.hover({ force: true });
  await page.waitForTimeout(600);
  await entry.locator('.entry-set-icon').click({ force: true });
  await page.waitForTimeout(600);

  // 点击"修改名称和图标"
  const renameItem = page.locator('li:has-text("修改名称和图标")').last();
  if (await renameItem.count() === 0) {
    console.log('  未找到"修改名称和图标"选项');
    // 关闭菜单
    await page.keyboard.press('Escape');
    return false;
  }

  await renameItem.click({ force: true });
  await page.waitForTimeout(1000);

  // 读取弹窗内容
  const dialogText = await page.locator('[class*="dialog"]').first().innerText().catch(() => '');
  console.log(`  弹窗内容: "${dialogText?.substring(0, 200)}"`);

  // 找输入框并改名
  const nameInput = page.locator('[class*="dialog"] input.input-inner, [class*="modify"] input.input-inner').first();
  if (await nameInput.count() > 0) {
    await nameInput.click({ clickCount: 3, force: true });
    await nameInput.fill(newName);
    await page.waitForTimeout(300);
  } else {
    console.log('  未找到名称输入框');
    await page.keyboard.press('Escape');
    return false;
  }

  // 点确定
  const confirmBtn = page.locator('button:has-text("确定")').last();
  if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(1500);
    console.log(`  ✓ 已重命名为 "${newName}"`);
    return true;
  }

  console.log('  未找到确定按钮');
  return false;
}

async function main() {
  console.log('[RENAME] 重命名表单...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 读取页面
    const text = await readPage(page);
    console.log(`页面内容:\n${text.substring(0, 500)}\n`);

    // 获取所有 tree-node
    const treeNodes = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`表单列表: ${treeNodes.join(', ')}`);

    // 重命名每个"未命名表单"
    let renameIdx = 0;
    for (const nodeName of treeNodes) {
      if (nodeName === '未命名表单' && renameIdx < NEW_NAMES.length) {
        await renameOneForm(page, '未命名表单', NEW_NAMES[renameIdx]);
        renameIdx++;

        // 刷新页面
        await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
        await waitForStableDOM(page);
        await page.waitForTimeout(2000);
      }
    }

    // 最终检查
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(2000);
    const finalNames = await page.$$eval('.entry-name', els => els.map(el => el.textContent?.trim()));
    console.log(`\n最终表单列表: ${finalNames.join(', ')}`);

    await page.screenshot({ path: 'screenshots/renamed.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
