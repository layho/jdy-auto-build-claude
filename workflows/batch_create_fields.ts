/**
 * Batch test: add ALL field types in one session.
 * Usage: npx tsx workflows/batch_create_fields.ts
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login, navigateToApp,
  smartLocate, tryLocate, waitForStableDOM, retry, recover, validateSave,
  logWorkflow, logWorkflowEnd, startWatchdog, stopWatchdog,
} from '../runtime';
import selectors from '../selectors/form.json';

dotenv.config();

type FieldType = keyof typeof selectors.field.field_type_option;

// Widget label → type key mapping
const ALL_FIELDS: { type: FieldType; name?: string }[] = [
  { type: 'text' },
  { type: 'textarea' },
  { type: 'number' },
  { type: 'datetime' },
  { type: 'radio' },
  { type: 'checkbox' },
  { type: 'select' },
  { type: 'multi_select' },
  { type: 'member_single' },
  { type: 'member_multi' },
  { type: 'dept_single' },
  { type: 'dept_multi' },
  { type: 'divider', name: undefined },
  { type: 'tabs' },
  { type: 'image' },
  { type: 'attachment' },
  { type: 'address' },
  { type: 'location' },
  { type: 'subform' },
  { type: 'query' },
  { type: 'choose_data' },
  { type: 'signature' },
  { type: 'serial' },
  { type: 'phone' },
  { type: 'ocr' },
  { type: 'button' },
  { type: 'calc' },
  { type: 'richtext' },
  { type: 'link_data' },
  { type: 'link_subtable' },
];

async function addField(page: Page, fieldType: FieldType, customName?: string): Promise<boolean> {
  // Click field type widget
  const typeSelectors = selectors.field.field_type_option[fieldType];
  if (!typeSelectors) throw new Error(`unknown field type: ${fieldType}`);
  const typeOption = await smartLocate(page, typeSelectors);
  await typeOption.click();
  await page.waitForTimeout(800);

  // Try to set field name (some fields like divider have no title)
  const nameInput = await tryLocate(page, selectors.field.field_name_input);
  if (nameInput && customName !== undefined) {
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(customName);
  }
  // If nameInput exists but no customName, use the default (widget auto-names it)

  // Save
  const saveBtn = await smartLocate(page, selectors.field.field_save_btn);
  await saveBtn.click();
  await waitForStableDOM(page);
  const saved = await validateSave(page);
  return saved;
}

async function main(): Promise<void> {
  logWorkflow('batch_create_fields');
  const watchdog = startWatchdog();
  const session = await launchBrowser();

  let passed = 0;
  let failed: string[] = [];

  try {
    await login(session.page);
    await navigateToApp(session.page, '爱马仕');

    await waitForStableDOM(session.page);
    await session.page.waitForTimeout(1000);

    // Enter edit mode once
    const editBtn = await smartLocate(session.page, selectors.field.edit_mode_btn);
    await editBtn.click();
    console.log('[WORKFLOW] entered edit mode');
    await waitForStableDOM(session.page);
    await session.page.waitForTimeout(1000);

    for (let i = 0; i < ALL_FIELDS.length; i++) {
      const field = ALL_FIELDS[i];
      const label = `${i + 1}/${ALL_FIELDS.length}`;
      try {
        const name = field.name !== undefined ? field.name : field.type;
        console.log(`\n[${label}] ${field.type}`);
        const ok = await retry(() => addField(session.page, field.type, field.name), 1);
        console.log(`[${label}] ${field.type} ${ok ? 'OK' : 'FAIL (save unconfirmed)'}`);
        if (ok) passed++;
        else failed.push(field.type);
      } catch (err) {
        console.log(`[${label}] ${field.type} ERROR: ${err}`);
        failed.push(field.type);
      }
    }

    console.log(`\n[RESULT] Passed: ${passed}/${ALL_FIELDS.length}`);
    if (failed.length > 0) console.log(`[RESULT] Failed (${failed.length}): ${failed.join(', ')}`);

  } catch (error) {
    console.error('[WORKFLOW] batch_create_fields error:', error);
    await recover(session.page);
    throw error;
  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
    logWorkflowEnd('batch_create_fields');
  }
}

main().catch((err) => {
  console.error('[WORKFLOW] fatal error:', err);
  process.exit(1);
});
