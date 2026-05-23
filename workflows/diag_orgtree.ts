/**
 * 诊断：展开组织架构找到"齐"并设置权限
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 展开组织架构...\n');
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

    // 展开"雄展中国事业部"
    console.log('[DIAG] 展开"雄展中国事业部"...');
    const deptNode = page.locator('[class*="tree"] [class*="node"]:has-text("雄展中国事业部"), [class*="org"] [class*="item"]:has-text("雄展中国事业部"), span:has-text("雄展中国事业部")').first();
    console.log(`[DIAG] 部门节点数: ${await deptNode.count()}`);

    if (await deptNode.count() > 0) {
      // 双击展开
      await deptNode.dblclick({ force: true });
      await page.waitForTimeout(1000);
    }

    // 看看有没有展开箭头
    const expandIcons = await page.$$eval('[class*="expand"], [class*="arrow"], [class*="toggle"], [class*="switch"]', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        class: (el as HTMLElement).className?.substring(0, 100),
        text: el.textContent?.trim(),
      }))
    );
    console.log(`[DIAG] 展开图标:`, expandIcons.slice(0, 10));

    // 直接找包含"齐"的元素
    let text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 页面内容:\n${text.substring(0, 2500)}`);

    await page.screenshot({ path: 'screenshots/diag-orgtree.png', fullPage: true });

    // 找checkbox或选择框
    const checkboxes = await page.$$eval('input[type="checkbox"], [class*="check"]', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        class: (el as HTMLElement).className?.substring(0, 100),
        checked: (el as HTMLInputElement).checked,
      }))
    );
    console.log(`[DIAG] checkboxes:`, checkboxes.slice(0, 10));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
