/**
 * 诊断：逐个展开组织架构找到齐娜
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] 展开组织架构查找齐娜...\n');
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

    // 点表单发布
    await page.locator('li.tab-header-item:has-text("表单发布")').first().click({ force: true });
    await page.waitForTimeout(2000);
    await waitForStableDOM(page);

    // 点添加成员
    await page.locator('button:has-text("添加成员")').first().click({ force: true });
    await page.waitForTimeout(2000);

    // 获取 tree node 结构
    const treeNodes = await page.$$eval('.tree-node', els =>
      els.map(el => {
        const text = el.textContent?.trim() || '';
        const cls = (el as HTMLElement).className;
        const key = cls.match(/tree-node-key-(\w+)/)?.[1] || '';
        const hasSwitcher = el.querySelector('.node-switcher') !== null;
        const swCls = el.querySelector('.node-switcher')?.className || '';
        const checked = el.querySelector('.check-checked') !== null;
        return { text: text.substring(0, 30), key, hasSwitcher, swCls, checked };
      })
    );
    console.log('[DIAG] Tree nodes:');
    treeNodes.forEach(n => console.log(`  "${n.text}" key=${n.key} switcher=${n.hasSwitcher} swCls=${n.swCls} checked=${n.checked}`));

    // 找到"雄展中国事业部"节点，展开它
    const targetNode = page.locator('.tree-node').filter({ hasText: '雄展中国事业部' }).first();
    if (await targetNode.count() > 0) {
      // 点击它的 node-switcher 展开
      const sw = targetNode.locator('.node-switcher').first();
      if (await sw.count() > 0) {
        const swCls = await sw.getAttribute('class').catch(() => '');
        console.log(`\n[DIAG] 雄展中国事业部 switcher class: ${swCls}`);
        await sw.click({ force: true });
        await page.waitForTimeout(1500);

        // 再次读取 tree nodes
        const expandedNodes = await page.$$eval('.tree-node', els =>
          els.map(el => ({
            text: (el.textContent?.trim() || '').substring(0, 40),
            key: (el as HTMLElement).className.match(/tree-node-key-(\w+)/)?.[1] || '',
            checked: el.querySelector('.check-checked') !== null,
          }))
        );
        console.log('[DIAG] 展开后 nodes:');
        expandedNodes.forEach(n => console.log(`  "${n.text}" key=${n.key} checked=${n.checked}`));

        await page.screenshot({ path: 'screenshots/diag-expanded-dept.png', fullPage: true });
      }
    }

    // 如果还是没找到齐娜，尝试搜索 "anna"
    console.log('\n[DIAG] 搜索 "anna"...');
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="关键字"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.click({ clickCount: 3, force: true });
      await searchInput.fill('anna');
      await page.waitForTimeout(1500);

      const text = await page.locator('body').first().innerText().catch(() => '');
      console.log(`[DIAG] 搜索 "anna" 结果:\n${text.substring(0, 2000)}`);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
