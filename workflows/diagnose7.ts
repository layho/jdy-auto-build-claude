/**
 * Diagnose: after adding a field, find the field name input in the properties panel.
 * Click on the newly added field first to activate properties panel.
 */
import * as dotenv from 'dotenv';
import { launchBrowser, closeBrowser, login, navigateToApp, waitForStableDOM, smartLocate } from '../runtime';
import { startWatchdog, stopWatchdog } from '../runtime';

dotenv.config();

async function main() {
  console.log('[DIAGNOSE7] starting...');
  const wd = startWatchdog({ hardTimeoutMs: 120_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);
    await navigateToApp(page, '爱马仕');

    // Enter edit mode
    await waitForStableDOM(page);
    await page.waitForTimeout(1000);
    const editBtn = await smartLocate(page, ["button:has-text('编辑')"]);
    await editBtn.click();
    console.log('[DIAGNOSE7] entered edit mode');
    await waitForStableDOM(page);
    await page.waitForTimeout(1500);

    // Add a number field by clicking the widget
    const numWidget = await smartLocate(page, ["li.form-edit-widget-label:has-text('数字')"]);
    await numWidget.click();
    console.log('[DIAGNOSE7] added number field');
    await page.waitForTimeout(1000);

    // Click on the last field in the form canvas to select it
    // The form fields have class fx-field
    const fields = page.locator('.fx-field');
    const count = await fields.count();
    console.log(`[DIAGNOSE7] fields on canvas: ${count}`);
    if (count > 0) {
      await fields.last().click();
      console.log('[DIAGNOSE7] clicked last field on canvas');
    }
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'screenshots/diagnose7-properties.png', fullPage: true });

    // Now find ALL inputs in the properties panel
    const allInputs = await page.$$eval('input', els =>
      els.map(el => ({
        type: el.getAttribute('type'),
        placeholder: el.getAttribute('placeholder'),
        value: el.getAttribute('value'),
        class: el.getAttribute('class')?.substring(0, 120),
      }))
    );
    console.log('[DIAGNOSE7] All inputs:', JSON.stringify(allInputs, null, 2));

    // Find property panel content
    const propPanel = await page.evaluate(() => {
      const panel = document.querySelector('[class*="field-property"]') ||
                    document.querySelector('[class*="property-panel"]') ||
                    document.querySelector('[class*="setting"]') ||
                    document.querySelector('[class*="config"]');
      return panel ? panel.innerHTML.substring(0, 2000) : 'no property panel';
    });
    console.log('[DIAGNOSE7] Property panel HTML:');
    console.log(propPanel);

    // Find all text with 标题/名称/字段 in properties area
    const labelTexts = await page.$$eval('[class*="property"] *, [class*="setting"] *, [class*="config"] *', els =>
      els.filter(el => {
        const text = el.textContent?.trim() || '';
        return /[标题|名称|字段]/.test(text) && el.children.length === 0;
      }).slice(0, 10).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 60),
        class: el.getAttribute('class')?.substring(0, 100),
      }))
    );
    console.log('[DIAGNOSE7] Label texts in properties:', JSON.stringify(labelTexts, null, 2));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
