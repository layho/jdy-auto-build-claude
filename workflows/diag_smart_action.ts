/**
 * Diagnostic: check current smart assistant editor state
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
  console.log('[DIAG SMART ACTION]\n');
  const wd = startWatchdog({ hardTimeoutMs: 300_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    await page.goto(EDITOR_URL, { waitUntil: 'domcontentloaded' });
    await waitForStableDOM(page);
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'screenshots/diag-smart-current.png', fullPage: true });

    // Check nodes on canvas
    const nodes = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="node"], [class*="Node"], .vue-flow__node')].map(n => ({
        class: n.className?.substring(0, 80),
        text: (n as HTMLElement).innerText?.substring(0, 100),
      }));
    });
    console.log('Canvas nodes:');
    nodes.forEach(n => console.log(`  [${n.class}] "${n.text}"`));

    // Check if drawer is open
    const drawer = page.locator('.fx-automation-node-config-drawer');
    const drawerOpen = await drawer.count() > 0;
    console.log(`\nDrawer open: ${drawerOpen}`);

    if (drawerOpen) {
      const drawerText = await drawer.first().innerText().catch(() => '');
      console.log(`Drawer content:\n${drawerText.substring(0, 1500)}`);
    }

    // Check body text
    const bodyText = await page.locator('body').first().innerText().catch(() => '');
    console.log(`\nBody (first 1000):\n${bodyText.substring(0, 1000)}`);

    // If drawer is open, try to click "请选择字段"
    const placeholder = page.locator('.fx-automation-node-config-drawer .placeholder:has-text("请选择字段")').first();
    const placeholderCount = await placeholder.count();
    console.log(`\n"请选择字段" placeholders: ${placeholderCount}`);

    if (placeholderCount > 0) {
      await placeholder.click({ force: true });
      await page.waitForTimeout(1500);

      await page.screenshot({ path: 'screenshots/diag-smart-field-popover.png', fullPage: true });

      // Dump popover content
      const popoverData = await page.evaluate(() => {
        const popovers = document.querySelectorAll('[class*="popover"], [class*="dropdown"], [class*="select-dropdown"]');
        return [...popovers].filter(p => {
          const rect = p.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).map(p => ({
          class: p.className?.substring(0, 80),
          text: (p as HTMLElement).innerText?.substring(0, 500),
          visible: p.checkVisibility?.() ?? true,
        }));
      });
      console.log('\nVisible popovers/dropdowns:');
      popoverData.forEach((p: any) => console.log(`  [${p.class}] visible=${p.visible}\n  "${p.text}"\n  ---`));

      // Try to find field options
      const options = await page.evaluate(() => {
        const all = document.querySelectorAll('[class*="option"], [class*="item"], [class*="entry"], li, .menu-item');
        return [...all].filter(el => {
          const rect = el.getBoundingClientRect();
          const text = (el as HTMLElement).innerText?.trim() || '';
          return rect.width > 0 && rect.height > 0 && text.length > 0 && text.length < 100;
        }).slice(0, 20).map(el => ({
          tag: el.tagName,
          class: el.className?.substring(0, 60),
          text: (el as HTMLElement).innerText?.trim()?.substring(0, 60),
        }));
      });
      console.log('\nOption items:');
      options.forEach((o: any) => console.log(`  <${o.tag}> [${o.class}] "${o.text}"`));

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
