/**
 * ERP BUILD V2 - Strictly follow design document field-by-field
 *
 * Design Doc Reference:
 * 4.1 商品资料: 商品编码/商品名称/商品分类/品牌/规格型号/单位/采购价/销售价/安全库存/状态/备注
 * 4.2 客户资料: 客户编号/客户名称/联系人/联系电话/地址/客户等级/信用额度/状态/备注
 * 4.3 供应商资料: 供应商编号/供应商名称/联系人/联系电话/地址/结算方式/状态/备注
 * 5.1 采购订单(主+子): 采购单号/供应商/采购日期/采购员/总金额/状态/备注 + 采购明细(商品/商品编码/数量/单价/金额)
 * 5.2 采购入库单: 入库单号/关联采购单/入库日期/仓库/入库状态 + 入库明细(商品/数量/单位)
 * 6.1 销售订单(主+子): 销售单号/客户/销售日期/销售员/总金额/状态 + 销售明细(商品/数量/单价/金额)
 * 6.2 销售出库单: 出库单号/关联销售单/出库日期/仓库/状态
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

interface FieldSpec { name: string; type: string; options?: string; }

async function createForm(page: any, formName: string, mainFields: FieldSpec[], subTable?: { name: string; fields: FieldSpec[] }): Promise<string> {
  console.log(`\n[BUILD] ${formName}`);

  // Navigate and open add menu - handle both empty app and app-with-forms states
  await page.goto('https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06', { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page); await page.waitForTimeout(3000);

  const bodyText = await page.locator('body').first().innerText().catch(() => '');

  if (bodyText.includes('创建以下对象') || bodyText.includes('新建表单')) {
    // Empty app page - click the 新建表单 card (the coop entry)
    await page.locator('.entry-create-icon.coop').first().click({ force: true });
    console.log('  Clicked 新建表单 card');
  } else {
    // App has items - use the add button
    await page.evaluate(() => { const btn = document.querySelector('button.add-button') as HTMLButtonElement; if (btn) btn.click(); });
    await page.waitForTimeout(1000);
    await page.locator('.x-menu-item:has-text("新建表单")').first().click({ force: true });
  }
  await page.waitForTimeout(2000);
  await waitForStableDOM(page);
  await page.waitForTimeout(1500); await waitForStableDOM(page);
  const t = await page.locator('body').first().innerText().catch(() => '');
  if (t.includes('创建空白表单')) { await page.locator(':text-is("创建空白表单")').first().click({ force: true }); await page.waitForTimeout(3000); await waitForStableDOM(page); }

  // Rename
  const ta = page.locator('[class*="title"]').first();
  if (await ta.count() > 0) { await ta.click({ force: true }); await page.waitForTimeout(500); }
  const ni = page.locator('input').first();
  if (await ni.isVisible({ timeout: 500 }).catch(() => false)) { await ni.fill(formName); await page.keyboard.press('Enter'); await page.waitForTimeout(1000); }

  const fid = page.url().match(/form\/([a-f0-9]+)\/edit/)?.[1] || 'unknown';
  console.log(`  ID: ${fid}`);

  // Add main fields
  for (const f of mainFields) {
    await addFieldToCanvas(page, f);
  }

  // Add sub-table if specified
  if (subTable) {
    console.log(`  [SUB] ${subTable.name}`);
    // Add 子表单 field
    await clickFieldType(page, '子表单');
    await setFieldTitle(page, subTable.name);

    // Click into sub-form
    const sf = page.locator('[class*="sub-form"]').first();
    if (await sf.count() > 0) { await sf.click({ force: true }); await page.waitForTimeout(800); }

    for (const f of subTable.fields) {
      await addFieldToCanvas(page, f);
    }
  }

  // Save
  await page.evaluate(() => { for (const btn of document.querySelectorAll('button')) { if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) (btn as HTMLButtonElement).click(); } });
  await page.waitForTimeout(3000); await waitForStableDOM(page);
  await page.screenshot({ path: `screenshots/v2-${formName}.png`, fullPage: true });
  console.log(`  Saved`);
  return fid;
}

async function clickFieldType(page: any, typeName: string) {
  const el = page.locator(`li[title="${typeName}"]`).first();
  for (let r = 0; r < 3; r++) {
    if (await el.count() > 0 && await el.isVisible({ timeout: 300 }).catch(() => false)) {
      await el.click({ force: true }); await page.waitForTimeout(800); return;
    }
    // Expand collapsed sections
    const sections = page.locator('[class*="widget-cate"]');
    for (let i = 0; i < await sections.count(); i++) {
      const s = sections.nth(i);
      const ul = s.locator('+ ul').first();
      if (!(await ul.isVisible({ timeout: 100 }).catch(() => false))) { await s.click({ force: true }); await page.waitForTimeout(300); }
    }
    await page.waitForTimeout(500);
  }
}

async function setFieldTitle(page: any, title: string) {
  await page.waitForTimeout(300);
  const inp = page.locator('[class*="field-config"] input, [class*="property"] input').first();
  if (await inp.isVisible({ timeout: 800 }).catch(() => false)) {
    await inp.fill(title); await page.waitForTimeout(300);
  }
}

async function setFieldOptions(page: any, options: string) {
  const batchBtn = page.locator('button:has-text("批量编辑")').first();
  if (await batchBtn.count() > 0 && await batchBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await batchBtn.click({ force: true }); await page.waitForTimeout(500);
    const ta = page.locator('textarea').first();
    if (await ta.count() > 0 && await ta.isVisible({ timeout: 500 }).catch(() => false)) {
      await ta.fill(options); await page.waitForTimeout(300);
      const cfm = page.locator('button:has-text("确定")').first();
      if (await cfm.isVisible({ timeout: 500 }).catch(() => false)) { await cfm.click({ force: true }); await page.waitForTimeout(300); }
    }
  }
}

async function addFieldToCanvas(page: any, f: FieldSpec) {
  await clickFieldType(page, f.type);
  await setFieldTitle(page, f.name);
  if (f.options) { await setFieldOptions(page, f.options); }
  console.log(`    + ${f.name} (${f.type})${f.options ? ' [' + f.options.replace(/\n/g, ',') + ']' : ''}`);
}

async function configureDataSources(page: any, formId: string, fieldConfigs: { fieldName: string; sourceForm: string }[]) {
  await page.goto(`https://www.jiandaoyun.com/dashboard/app/6a0aa9d82c4789aa80588d06/form/${formId}/edit#/edit`, { waitUntil: 'domcontentloaded' });
  await waitForStableDOM(page); await page.waitForTimeout(3000);

  for (const fc of fieldConfigs) {
    const fieldEl = page.locator(`.field-name:text-is("${fc.fieldName}")`).first();
    if (await fieldEl.count() > 0) {
      await fieldEl.click({ force: true }); await page.waitForTimeout(800);
      const dd = page.locator('[class*="config"] .x-biz-dropdown-label').first();
      if (await dd.count() > 0 && await dd.isVisible({ timeout: 500 }).catch(() => false)) {
        await dd.click({ force: true }); await page.waitForTimeout(800);
        const entry = page.locator(`[class*="popover"] .entry-item:has-text("${fc.sourceForm}")`).first();
        if (await entry.count() > 0 && await entry.isVisible({ timeout: 1000 }).catch(() => false)) {
          await entry.click({ force: true }); await page.waitForTimeout(500);
          console.log(`  ${fc.fieldName} → ${fc.sourceForm}`);
        }
      }
    }
  }

  await page.evaluate(() => { for (const btn of document.querySelectorAll('button')) { if (btn.innerText?.trim() === '保存' && !(btn as HTMLButtonElement).disabled) (btn as HTMLButtonElement).click(); } });
  await page.waitForTimeout(3000); await waitForStableDOM(page);
}

async function main() {
  console.log('[ERP BUILD V2] Strict design doc compliance\n');
  const wd = startWatchdog({ hardTimeoutMs: 900_000 });
  const s = await launchBrowser();
  const ids: Record<string, string> = {};

  try {
    const { page } = s;
    await login(page);

    // ====== 4.1 商品资料 ======
    ids.product = await createForm(page, '商品资料', [
      { name: '商品编码', type: '单行文本' },
      { name: '商品名称', type: '单行文本' },
      { name: '商品分类', type: '下拉框', options: '手机\n笔记本\n家电' },
      { name: '品牌', type: '单行文本' },
      { name: '规格型号', type: '单行文本' },
      { name: '单位', type: '下拉框', options: '件\n箱\n个' },
      { name: '采购价', type: '数字' },
      { name: '销售价', type: '数字' },
      { name: '安全库存', type: '数字' },
      { name: '状态', type: '单选按钮组', options: '启用\n停用' },
      { name: '备注', type: '多行文本' },
    ]);

    // ====== 4.2 客户资料 ======
    ids.customer = await createForm(page, '客户资料', [
      { name: '客户编号', type: '单行文本' },
      { name: '客户名称', type: '单行文本' },
      { name: '联系人', type: '单行文本' },
      { name: '联系电话', type: '手机' },
      { name: '地址', type: '地址' },
      { name: '客户等级', type: '下拉框', options: 'VIP\nA级\nB级\nC级' },
      { name: '信用额度', type: '数字' },
      { name: '状态', type: '单选按钮组', options: '启用\n停用' },
      { name: '备注', type: '多行文本' },
    ]);

    // ====== 4.3 供应商资料 ======
    ids.supplier = await createForm(page, '供应商资料', [
      { name: '供应商编号', type: '单行文本' },
      { name: '供应商名称', type: '单行文本' },
      { name: '联系人', type: '单行文本' },
      { name: '联系电话', type: '手机' },
      { name: '地址', type: '地址' },
      { name: '结算方式', type: '下拉框', options: '月结30天\n月结60天\n现结' },
      { name: '状态', type: '单选按钮组', options: '启用\n停用' },
      { name: '备注', type: '多行文本' },
    ]);

    // ====== 5.1 采购订单 (主+子) ======
    ids.po = await createForm(page, '采购订单', [
      { name: '采购单号', type: '单行文本' },
      { name: '供应商', type: '查询' },
      { name: '采购日期', type: '日期时间' },
      { name: '采购员', type: '成员单选' },
      { name: '总金额', type: '数字' },
      { name: '状态', type: '单选按钮组', options: '待审批\n已审批\n已完成\n已取消' },
      { name: '备注', type: '多行文本' },
    ], {
      name: '采购明细',
      fields: [
        { name: '商品', type: '选择数据' },
        { name: '商品编码', type: '关联数据' },
        { name: '数量', type: '数字' },
        { name: '单价', type: '数字' },
        { name: '金额', type: '计算' },
      ]
    });

    // ====== 5.2 采购入库单 ======
    ids.receipt = await createForm(page, '采购入库单', [
      { name: '入库单号', type: '单行文本' },
      { name: '关联采购单', type: '选择数据' },
      { name: '入库日期', type: '日期时间' },
      { name: '仓库', type: '下拉框', options: '主仓库\n次仓库\n退货仓' },
      { name: '入库状态', type: '单选按钮组', options: '待入库\n已入库\n已取消' },
    ], {
      name: '入库明细',
      fields: [
        { name: '商品', type: '选择数据' },
        { name: '数量', type: '数字' },
        { name: '单位', type: '单行文本' },
      ]
    });

    // ====== 6.1 销售订单 (主+子) ======
    ids.so = await createForm(page, '销售订单', [
      { name: '销售单号', type: '单行文本' },
      { name: '客户', type: '选择数据' },
      { name: '销售日期', type: '日期时间' },
      { name: '销售员', type: '成员单选' },
      { name: '总金额', type: '数字' },
      { name: '状态', type: '单选按钮组', options: '待审批\n已审批\n已完成\n已取消' },
    ], {
      name: '销售明细',
      fields: [
        { name: '商品', type: '选择数据' },
        { name: '数量', type: '数字' },
        { name: '单价', type: '数字' },
        { name: '金额', type: '计算' },
      ]
    });

    // ====== 6.2 销售出库单 ======
    ids.shipment = await createForm(page, '销售出库单', [
      { name: '出库单号', type: '单行文本' },
      { name: '关联销售单', type: '选择数据' },
      { name: '出库日期', type: '日期时间' },
      { name: '仓库', type: '下拉框', options: '主仓库\n次仓库\n退货仓' },
      { name: '状态', type: '单选按钮组', options: '待出库\n已出库\n已取消' },
    ]);

    // ====== Configure data sources ======
    console.log('\n[CONFIG] Data sources...');
    await configureDataSources(page, ids.po, [
      { fieldName: '供应商', sourceForm: '供应商资料' },
    ]);
    await configureDataSources(page, ids.so, [
      { fieldName: '客户', sourceForm: '客户资料' },
    ]);
    await configureDataSources(page, ids.receipt, [
      { fieldName: '关联采购单', sourceForm: '采购订单' },
    ]);
    await configureDataSources(page, ids.shipment, [
      { fieldName: '关联销售单', sourceForm: '销售订单' },
    ]);

    console.log('\n[DONE] All forms built per design doc');
    console.log(JSON.stringify(ids, null, 2));

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
