/**
 * Diagnose: List all forms in the current app and find delete/rename UI.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAG] Listing forms and finding management UI...');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await navigateToApp(page, '爱马仕');

    await waitForStableDOM(page);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'screenshots/diag-form-list.png', fullPage: true });

    // List all form/menu items in the left sidebar
    const menuItems = await page.$$eval('.fx-app-menu-tree *, [class*="menu"] *, [class*="tree"] *, [class*="entry"] *', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.length > 0 && text.length < 100 && el.children.length === 0;
      }).slice(0, 30).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 100),
      }))
    );
    console.log('[DIAG] Menu items:');
    menuItems.forEach((item, i) => console.log(`  ${i}: ${item.text} (${item.tag}.${item.class?.substring(0, 40)})`));

    // Find all elements that could be delete/rename actions
    const actions = await page.$$eval('button, a, [role="button"]', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        return /(删除|重命名|更多|设置|管理|操作)/.test(text);
      }).map(el => ({
        text: el.textContent?.trim().substring(0, 80),
        tag: el.tagName,
        class: el.getAttribute('class')?.substring(0, 120),
      }))
    );
    console.log('[DIAG] Action buttons:');
    actions.forEach((a, i) => console.log(`  ${i}: "${a.text}" (${a.tag})`));

    // Find form entry nodes that have context menus (right-click or ... button)
    const formEntries = await page.$$eval('.tree-node, .fx-entry-node, [class*="form-item"], [class*="entry"]', els =>
      els.map(el => ({
        text: el.textContent?.trim().substring(0, 80),
        class: el.getAttribute('class')?.substring(0, 150),
        hasMoreBtn: !!el.querySelector('[class*="more"], [class*="action"], [class*="menu"]'),
      }))
    );
    console.log('[DIAG] Form entries:');
    formEntries.forEach((entry, i) => console.log(`  ${i}:`, JSON.stringify(entry)));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
