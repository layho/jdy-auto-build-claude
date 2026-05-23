/**
 * V2 Workflow: create_form
 *
 * Creates a new form in the 爱马仕 app.
 *
 * Input:  form name (via FORM_NAME env or default)
 * Output: created form in 简道云
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

const FORM_NAME = process.env.FORM_NAME || '测试表单';
const TARGET_APP = process.env.JDY_TARGET_APP || '爱马仕';

async function main(): Promise<void> {
  logWorkflow('create_form');
  const watchdog = startWatchdog();
  const session = await launchBrowser();

  try {
    // Phase 1: Setup (do not retry - if this fails, fail fast)
    await login(session.page);
    await navigateToApp(session.page, TARGET_APP);

    // Phase 2: Form creation (retryable)
    await retry(() => createFormInApp(session.page), 2);

    console.log('[WORKFLOW] create_form completed successfully');
  } catch (error) {
    console.error('[WORKFLOW] create_form failed:', error);
    await recover(session.page);
    throw error;
  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
    logWorkflowEnd('create_form');
  }
}

async function createFormInApp(page: Page): Promise<void> {
  console.log(`[WORKFLOW] current URL: ${page.url()}`);

  // Step 1: Wait for app to be fully loaded
  await waitForStableDOM(page);
  await page.waitForTimeout(1000);

  // Step 2: Find and click create form button
  const createBtn = await smartLocate(page, selectors.form.create_form_btn);
  await createBtn.click();
  console.log('[WORKFLOW] create form button clicked');
  await waitForStableDOM(page);

  // Step 3: Fill form name
  const nameInput = await smartLocate(page, selectors.form.form_name_input);
  await nameInput.click();
  await nameInput.fill(FORM_NAME);
  console.log(`[WORKFLOW] form name set: ${FORM_NAME}`);

  // Step 4: Save
  const saveBtn = await smartLocate(page, selectors.form.form_save_btn);
  await saveBtn.click();
  console.log('[SAVE] form save triggered');
  await waitForStableDOM(page);

  // Step 5: Validate save
  const saved = await validateSave(page);
  if (!saved) {
    throw new Error('[WORKFLOW] form save validation failed');
  }

  console.log(`[WORKFLOW] created form: ${FORM_NAME}`);
}

main().catch((err) => {
  console.error('[WORKFLOW] fatal error:', err);
  process.exit(1);
});
