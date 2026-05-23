/**
 * 诊断：在添加成员弹窗中点"确定"，看下一步是什么
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 点击确定后的权限设置...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // 进入表单编辑器的表单发布
    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1060b33b91be59b687ca54/edit#/edit', {
      waitUntil: 'domcontentloaded',
    });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // 点表单发布
    await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // 点添加成员
    await page.locator('button:has-text("添加成员")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // 先展开节点找具体成员 - 点击 node-switcher
    console.log('[DIAG] 展开所有 node-switcher...');
    const switchers = page.locator('.node-switcher');
    const swCount = await switchers.count();
    console.log(`[DIAG] switcher 数量: ${swCount}`);

    // 展开所有可展开的节点
    for (let i = 0; i < swCount; i++) {
      const sw = switchers.nth(i);
      const cls = await sw.getAttribute('class').catch(() => '');
      if (cls && !cls.includes('noop')) {
        await sw.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // 读取内容
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 展开后内容:\n${text.substring(0, 3000)}`);

    await page.screenshot({ path: 'screenshots/diag-expanded.png', fullPage: true });

    // 找"齐" - 可能在展开的树中
    const qiElements = page.locator('[class*="tree"] [class*="node"]:has-text("齐")');
    console.log(`[DIAG] 树中"齐"节点数: ${await qiElements.count()}`);

    // 如果找到了"齐"，勾选它
    for (let i = 0; i < await qiElements.count(); i++) {
      const el = qiElements.nth(i);
      const elText = await el.innerText().catch(() => '');
      console.log(`[DIAG] 节点[${i}]: "${elText}"`);
    }

    // 点确定
    console.log('\n[DIAG] 点击"确定"...');
    const confirmBtn = page.locator('button:has-text("确定")').last();
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(2000);

      text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 确定后内容:\n${text.substring(0, 2500)}`);

      await page.screenshot({ path: 'screenshots/diag-after-confirm.png', fullPage: true });
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
