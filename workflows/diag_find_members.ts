/**
 * 诊断：展开部门找到具体成员（齐娜）
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 展开部门找成员...\n');
  const wd = startWatchdog({ hardTimeoutMs: 180_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/6a1060b33b91be59b687ca54/edit#/edit', {
      waitUntil: 'domcontentloaded',
    });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    await page.locator('button:has-text("添加成员")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // 先展开"雄展中国事业部"
    let deptNode = page.locator('.tree-node').filter({ hasText: '雄展中国事业部' }).first();
    await deptNode.locator('.node-switcher').first().click({ force: true });
    await page.waitForTimeout(1000);

    // 展开所有子部门：经理室、销售部、采购部、财务部、技术部
    const subDepts = ['经理室', '销售部', '采购部', '财务部', '技术部'];
    for (const dept of subDepts) {
      const node = page.locator('.tree-node').filter({ hasText: dept }).first();
      const sw = node.locator('.node-switcher').first();
      if (await sw.count() > 0) {
        const swCls = await sw.getAttribute('class').catch(() => '');
        if (swCls && !swCls.includes('noop')) {
          console.log(`[DIAG] 展开"${dept}"...`);
          await sw.click({ force: true });
          await page.waitForTimeout(500);
        }
      }
    }

    // 列出所有可见节点
    const nodes = await page.$$eval('.tree-node', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        text: (el.textContent?.trim() || '').substring(0, 50),
        key: (el as HTMLElement).className.match(/tree-node-key-(\w+)/)?.[1] || '',
        hasSwitcher: el.querySelector('.node-switcher') !== null,
        swNoop: el.querySelector('.node-switcher-noop') !== null,
      }))
    );
    console.log('[DIAG] 展开后所有节点:');
    nodes.forEach(n => console.log(`  "${n.text}" key=${n.key} switcher=${n.hasSwitcher} noop=${n.swNoop}`));

    await page.screenshot({ path: 'screenshots/diag-all-expanded.png', fullPage: true });

    // 搜索"齐"（单个字试试）
    console.log('\n[DIAG] 搜索"齐"...');
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键字"]').first();
    await searchInput.click({ clickCount: 3, force: true });
    await searchInput.fill('齐');
    await page.waitForTimeout(1500);

    const text = await page.locator('body').first().innerText().catch(() => '');
    console.log(`[DIAG] 搜索结果:\n${text.substring(0, 2000)}`);

    await page.screenshot({ path: 'screenshots/diag-search-qi.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
