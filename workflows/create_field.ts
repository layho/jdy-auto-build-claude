/**
 * V2 Workflow: create_field
 *
 * Adds a field to the current form in design mode.
 *
 * Input:  FIELD_NAME, FIELD_TYPE (env vars)
 * Output: new field added to the form
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser,
  closeBrowser,
  login,
  navigateToApp,
  smartLocate,
  waitForStableDOM,
  retry,
  recover,
  validateSave,
  logWorkflow,
  logWorkflowEnd,
  startWatchdog,
  stopWatchdog,
} from '../runtime';
import selectors from '../selectors/form.json';

dotenv.config();

const FIELD_NAME = process.env.FIELD_NAME || '新字段';
const FIELD_TYPE = (process.env.FIELD_TYPE || 'text') as keyof typeof selectors.field.field_type_option;
const TARGET_APP = process.env.JDY_TARGET_APP || '爱马仕';

async function main(): Promise<void> {
  logWorkflow('create_field');
  const watchdog = startWatchdog();
  const session = await launchBrowser();

  try {
    // Phase 1: Setup (do not retry)
    await login(session.page);
    await navigateToApp(session.page, TARGET_APP);

    // Phase 2: Field creation in design mode (retryable)
    await retry(() => createFieldInApp(session.page), 2);

    console.log('[WORKFLOW] create_field completed successfully');
  } catch (error) {
    console.error('[WORKFLOW] create_field failed:', error);
    await recover(session.page);
    throw error;
  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
    logWorkflowEnd('create_field');
  }
}

async function createFieldInApp(page: Page): Promise<void> {
  // Step 1: Wait for app page to load
  await waitForStableDOM(page);
  await page.waitForTimeout(1000);
  console.log(`[WORKFLOW] current URL: ${page.url()}`);

  // Step 2: Enter design mode by clicking "编辑"
  const editBtn = await smartLocate(page, selectors.field.edit_mode_btn);
  await editBtn.click();
  console.log('[WORKFLOW] entered design mode');
  await waitForStableDOM(page);
  await page.waitForTimeout(1000);

  // Step 3: Click field type widget to add it to the form
  const typeSelectors = selectors.field.field_type_option[FIELD_TYPE];
  if (!typeSelectors) {
    throw new Error(`[WORKFLOW] unknown field type: ${FIELD_TYPE}`);
  }
  const typeOption = await smartLocate(page, typeSelectors);
  await typeOption.click();
  console.log(`[WORKFLOW] field type added: ${FIELD_TYPE}`);
  await waitForStableDOM(page);
  await page.waitForTimeout(500);

  // Step 4: Set field name - the field is auto-selected after adding
  // The title input is inside .fx-field-title-input, no placeholder attribute
  await page.waitForTimeout(500);
  const nameInput = await smartLocate(page, selectors.field.field_name_input);
  await nameInput.click();
  await page.waitForTimeout(200);
  // Triple-click to select all default text, then type the new name
  await nameInput.click({ clickCount: 3 });
  await nameInput.fill(FIELD_NAME);
  console.log(`[WORKFLOW] field name set: ${FIELD_NAME}`);

  // Step 5: Save the form
  const saveBtn = await smartLocate(page, selectors.field.field_save_btn);
  await saveBtn.click();
  console.log('[SAVE] form save triggered');
  await waitForStableDOM(page);

  // Step 6: Validate save
  const saved = await validateSave(page);
  console.log(`[WORKFLOW] save validated: ${saved}`);
}

main().catch((err) => {
  console.error('[WORKFLOW] fatal error:', err);
  process.exit(1);
});
