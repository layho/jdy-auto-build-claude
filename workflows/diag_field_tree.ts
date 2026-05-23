/**
 * Diag: explore tree structure in field selector
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const EDITOR_URL = 'https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/automation/6a110c3d63fbb50f9e104db2/edit';

async function main() {
  console.log('[DIAG FIELD TREE]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    // Click first "请选择字段"
    const placeholder = page.locator('.fx-automation-node-config-drawer .placeholder:has-text("请选择字段")').first();
    if (await placeholder.count() === 0) {
      console.log('No placeholder found - checking if drawer is open...');
      const drawer = page.locator('.fx-automation-node-config-drawer');
      const text = await drawer.first().innerText().catch(() => '');
      console.log(`Drawer: "${text.substring(0, 500)}"`);
      return;
    }

    await placeholder.click({ force: true });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/diag-tree-initial.png', fullPage: true });

    // Dump ALL tree items including their hierarchy
    const treeData = await page.evaluate(() => {
      const items = document.querySelectorAll('.tree-item');
      return [...items].map(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return null;
        const indent = el.querySelector('.tree-item-indent, [class*="indent"]');
        const expandBtn = el.querySelector('.tree-item-switcher, [class*="switcher"], [class*="expand"]');
        const text = (el as HTMLElement).innerText?.trim() || '';
        return {
          text: text.substring(0, 80),
          classes: el.className?.substring(0, 80),
          hasExpand: !!expandBtn,
          indentPx: indent ? (indent as HTMLElement).offsetWidth : 0,
          depth: Math.floor(((el as HTMLElement).offsetLeft || 0) / 20),
        };
      }).filter(Boolean);
    });

    console.log('Tree items:');
    treeData.forEach((t: any) => console.log(`  depth=${t.depth} expand=${t.hasExpand} "${t.text}" [${t.classes}]`));

    // If there are expandable items, expand the first one ("触发数据" or similar)
    const expandButtons = page.locator('.tree-item-switcher, .tree-item [class*="expand"], .tree-item [class*="switcher"]').first();
    if (await expandButtons.count() > 0 && await expandButtons.isVisible().catch(() => false)) {
      console.log('\n--- Expanding first tree node ---');
      await expandButtons.click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/diag-tree-expanded.png', fullPage: true });

      // Re-dump
      const expandedData = await page.evaluate(() => {
        const items = document.querySelectorAll('.tree-item');
        return [...items].map(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return null;
          const text = (el as HTMLElement).innerText?.trim() || '';
          return {
            text: text.substring(0, 80),
            classes: el.className?.substring(0, 80),
          };
        }).filter(Boolean);
      });
      console.log('\nAfter expand:');
      expandedData.forEach((t: any) => console.log(`  "${t.text}" [${t.classes}]`));
    }

    // Also dump ALL visible popover content
    const popoverRaw = await page.evaluate(() => {
      const popover = document.querySelector('[class*="popover"]:not([style*="display: none"])');
      if (!popover) return 'NO POPOVER';
      return (popover as HTMLElement).innerText?.substring(0, 2000);
    });
    console.log(`\nPopover raw text:\n${popoverRaw}`);

    // Try clicking leaf nodes to select a field
    const leafNodes = page.locator('.tree-item-leaf').first();
    if (await leafNodes.count() > 0 && await leafNodes.isVisible().catch(() => false)) {
      const leafText = await leafNodes.first().innerText().catch(() => '');
      console.log(`\nClicking first leaf: "${leafText}"`);
      await leafNodes.first().click({ force: true });
      await page.waitForTimeout(500);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Check field mapping state after selection
    const drawerText = await page.locator('.fx-automation-node-config-drawer').first().innerText().catch(() => '');
    console.log(`\nDrawer after selection:\n${drawerText.substring(0, 1000)}`);

    await page.screenshot({ path: 'screenshots/diag-tree-after-select.png', fullPage: true });

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
