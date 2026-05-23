/**
 * Fix all forms: proper field names, data sources, formulas
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

async function deleteAndRecreateForm(page: any, name: string, mainFields: {type: string, title: string}[], subFields?: {type: string, title: string}[]) {
  console.log(`\n[REBUILD] ${name}`);

  // Create new form
  await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page); await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const btn = document.querySelector('button.add-button') as HTMLButtonElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);
  await page.locator('.x-menu-item:has-text("新建表单")').first().click({ force: true });
  await page.waitForTimeout(1500); await waitForStableDOM(page);

  const bodyText = await page.locator('body').first().innerText().catch(() => '');
  if (bodyText.includes('创建空白表单')) {
    await page.locator(':text-is("创建空白表单")').first().click({ force: true });
    await page.waitForTimeout(3000); await waitForStableDOM(page);
  }

  // Rename
  const titleArea = page.locator('[class*="title"]').first();
  if (await titleArea.count() > 0) { await titleArea.click({ force: true }); await page.waitForTimeout(500); }
  const nameInput = page.locator('input').first();
  if (await nameInput.isVisible({ timeout: 500 }).catch(() => false)) {
    await nameInput.fill(name);
    await page.keyboard.press('Enter');
    console.log(`  Named: ${name}`);
    await page.waitForTimeout(1000);
  }

  const formId = page.url().match(/form\/([a-f0-9]+)\/edit/)?.[1] || 'unknown';
  console.log(`  ID: ${formId}`);

  // Add main fields with proper titles
  for (const field of mainFields) {
    const typeEl = page.locator(`li[title="${field.type}"]`).first();
    if (await typeEl.count() > 0) {
      // Expand sections if needed
      if (!(await typeEl.isVisible({ timeout: 200 }).catch(() => false))) {
        const sections = page.locator('[class*="widget-cate"]');
        for (let i = 0; i < await sections.count(); i++) {
          const section = sections.nth(i);
          const nextUl = section.locator('+ ul').first();
          if (!(await nextUl.isVisible({ timeout: 100 }).catch(() => false))) {
            await section.click({ force: true });
            await page.waitForTimeout(300);
          }
        }
      }
      await typeEl.scrollIntoViewIfNeeded();
      await typeEl.click({ force: true });
      await page.waitForTimeout(800);

      // Set field title
      const titleInput = page.locator('[class*="field-config"] input, [class*="property"] input').first();
      if (await titleInput.isVisible({ timeout: 500 }).catch(() => false)) {
        await titleInput.fill(field.title);
        await page.waitForTimeout(300);
      }
      console.log(`  + ${field.title} (${field.type})`);
    }
  }

  // Add sub-form if needed
  if (subFields && subFields.length > 0) {
    // Add 子表单
    const subFormType = page.locator('li[title="子表单"]').first();
    if (!(await subFormType.isVisible({ timeout: 200 }).catch(() => false))) {
      const sections = page.locator('[class*="widget-cate"]');
      for (let i = 0; i < await sections.count(); i++) {
        const section = sections.nth(i);
        const nextUl = section.locator('+ ul').first();
        if (!(await nextUl.isVisible({ timeout: 100 }).catch(() => false))) {
          await section.click({ force: true });
          await page.waitForTimeout(300);
        }
      }
    }
    await subFormType.click({ force: true });
    await page.waitForTimeout(800);
    const sfTitle = page.locator('[class*="field-config"] input, [class*="property"] input').first();
    if (await sfTitle.isVisible({ timeout: 500 }).catch(() => false)) {
      await sfTitle.fill('明细');
      await page.waitForTimeout(300);
    }
    console.log(`  + 明细 (子表单)`);

    // Click into sub-form to add fields
    const subFormEl = page.locator('[class*="sub-form"]').first();
    if (await subFormEl.count() > 0) {
      await subFormEl.click({ force: true });
      await page.waitForTimeout(800);
    }

    // Add sub-form fields
    for (const field of subFields) {
      const typeEl = page.locator(`li[title="${field.type}"]`).first();
      if (await typeEl.count() > 0) {
        if (!(await typeEl.isVisible({ timeout: 200 }).catch(() => false))) {
          const sections = page.locator('[class*="widget-cate"]');
          for (let i = 0; i < await sections.count(); i++) {
            const section = sections.nth(i);
            const nextUl = section.locator('+ ul').first();
            if (!(await nextUl.isVisible({ timeout: 100 }).catch(() => false))) {
              await section.click({ force: true });
              await page.waitForTimeout(300);
            }
          }
        }
        await typeEl.click({ force: true });
        await page.waitForTimeout(600);
        const titleInput = page.locator('[class*="field-config"] input, [class*="property"] input').first();
        if (await titleInput.isVisible({ timeout: 500 }).catch(() => false)) {
          await titleInput.fill(field.title);
          await page.waitForTimeout(200);
        }
        console.log(`    + ${field.title} (${field.type})`);
      }
    }
  }

  // Save
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) {
        (btn as HTMLButtonElement).click();
      }
    }
  });
  await page.waitForTimeout(3000); await waitForStableDOM(page);
  console.log(`  Saved`);

  await page.screenshot({ path: `screenshots/erp-rebuild-${name}.png`, fullPage: true });
  return formId;
}

async function main() {
  console.log('[FORM REBUILD]\n');
  const wd = startWatchdog({ hardTimeoutMs: 900_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    // Rebuild 采购入库单
    await deleteAndRecreateForm(page, '采购入库单', [
      { type: '单行文本', title: '入库单号' },
      { type: '选择数据', title: '关联采购单' },
      { type: '日期时间', title: '入库日期' },
      { type: '下拉框', title: '仓库' },
      { type: '单选按钮组', title: '入库状态' },
    ], [
      { type: '选择数据', title: '商品' },
      { type: '数字', title: '数量' },
      { type: '单行文本', title: '单位' },
    ]);

    // Rebuild 销售出库单
    await deleteAndRecreateForm(page, '销售出库单', [
      { type: '单行文本', title: '出库单号' },
      { type: '选择数据', title: '关联销售单' },
      { type: '日期时间', title: '出库日期' },
      { type: '下拉框', title: '仓库' },
      { type: '单选按钮组', title: '状态' },
    ]);

    console.log('\n[DONE] Forms rebuilt');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
