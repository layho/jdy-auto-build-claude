/**
 * Diagnose: Find form delete/rename context menu actions.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] Finding form context menu (delete/rename)...');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await navigateToApp(page, '爱马仕');

    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    // Hover over the form entry to reveal the ellipsis icon, then click it
    const formEntry = page.locator('.tree-node').first();
    await formEntry.hover();
    await page.waitForTimeout(500);
    const ellipsisBtn = page.locator('.entry-set-icon').first();
    await ellipsisBtn.waitFor({ state: 'visible', timeout: 5000 });
    await ellipsisBtn.click();
    console.log('[DIAG] clicked ellipsis on first form');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/diag-context-menu.png', fullPage: true });

    // Find ALL visible elements in the context menu / dropdown
    const allVisible = await page.$$eval('*', els =>
      els.filter(el => {
        const txt = (el.textContent?.trim() || '');
        return txt.length > 0 && txt.length < 50 && (el as HTMLElement).offsetParent !== null;
      }).slice(0, 50).map(el => ({
        tag: el.tagName,
        text: (el.textContent?.trim() || ''),
        class: (el as HTMLElement).className?.substring(0, 100) || '',
      }))
    );
    // Deduplicate and show menu items
    const menuItems = allVisible.filter(item =>
      /(删除|重命名|复制|移动|编辑|设置)/.test(item.text)
    );
    console.log('[DIAG] Context menu items:');
    menuItems.forEach((item, i) => console.log(`  ${i}: ${item.text} (${item.tag}.${item.class?.substring(0, 50)})`));

    // Also look for dropdown/popover menus
    const dropdowns = await page.$$eval('[class*="dropdown"], [class*="popover"], [class*="context"], [class*="menu-item"], [class*="action-item"]', els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        text: el.textContent?.trim().substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 150),
      }))
    );
    console.log('[DIAG] Dropdown items:');
    dropdowns.forEach((d, i) => console.log(`  ${i}: "${d.text}"`));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
