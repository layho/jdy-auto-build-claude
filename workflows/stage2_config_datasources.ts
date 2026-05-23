/**
 * stage2_config_datasources.ts — 配置各表单"选择数据"字段的关联表单
 *
 * 修复：
 * 1. 原来 configureDataSources 在同一次 goto 里循环处理多个字段，
 *    但简道云每次选数据源后有时会触发 rerender，导致后续字段找不到
 *    → 每个字段单独处理，处理后 waitForStableDOM
 * 2. 原来 .x-biz-dropdown-label 是硬编码 class，简道云版本不同可能不同
 *    → 加多个 fallback selector
 * 3. 表单 ID 从 stage1 输出的 JSON 中读取（或 .env 中手动配置）
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';

dotenv.config();

const APP_ID = process.env.JDY_APP_ID ?? '6a0aa9d82c4789aa80588d06';

// 从环境变量或 ids.json 读取 form IDs
function loadIds(): Record<string, string> {
  // 优先读 stage1 输出的 ids.json
  if (fs.existsSync('.temp/form_ids.json')) {
    return JSON.parse(fs.readFileSync('.temp/form_ids.json', 'utf-8'));
  }
  // 回退到 .env 中手动配置的 ID
  return {
    product:  process.env.FORM_ID_PRODUCT  ?? '',
    customer: process.env.FORM_ID_CUSTOMER ?? '',
    supplier: process.env.FORM_ID_SUPPLIER ?? '',
    po:       process.env.FORM_ID_PO       ?? '',
    receipt:  process.env.FORM_ID_RECEIPT  ?? '',
    so:       process.env.FORM_ID_SO       ?? '',
    shipment: process.env.FORM_ID_SHIPMENT ?? '',
  };
}

interface DataSourceConfig {
  formId: string;
  fieldName: string;
  sourceFormName: string;
  /** 子表单内的字段 */
  inSubTable?: string;
}

async function configOneField(
  page: any,
  formId: string,
  fieldName: string,
  sourceFormName: string,
  inSubTable?: string
): Promise<void> {
  console.log(`\n  [CONFIG] ${fieldName} → ${sourceFormName}${inSubTable ? ` (子表: ${inSubTable})` : ''}`);

  // 进入表单编辑器
  await page.goto(
    `https://www.jiandaoyun.com/dashboard/app/${APP_ID}/form/${formId}/edit#/edit`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForStableDOM(page);
  await page.waitForTimeout(3000);

  // 如果是子表单内的字段，先点击进入子表单
  if (inSubTable) {
    const subCanvas = page.locator(`.subform-widget:has-text("${inSubTable}"), [class*="sub-form"]:has-text("${inSubTable}")`).first();
    if (await subCanvas.isVisible({ timeout: 1500 }).catch(() => false)) {
      await subCanvas.click({ force: true });
      await page.waitForTimeout(800);
    }
  }

  // 点击目标字段（显示名）
  const fieldSelectors = [
    `.field-name:text-is("${fieldName}")`,
    `[data-field-name="${fieldName}"]`,
    `.widget-title:text-is("${fieldName}")`,
    `:text-is("${fieldName}")`,
  ];
  let clicked = false;
  for (const sel of fieldSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 600 }).catch(() => false)) {
      await el.click({ force: true });
      await page.waitForTimeout(800);
      clicked = true;
      break;
    }
  }
  if (!clicked) {
    console.warn(`  [WARN] 未找到字段: ${fieldName}`);
    return;
  }

  // 右侧属性面板：点击数据源下拉
  const ddSelectors = [
    '[class*="config"] .x-biz-dropdown-label',
    '[class*="property"] .x-biz-dropdown-label',
    'button:has-text("请选择")',
    '.link-data-source .x-biz-dropdown-label',
    '[placeholder*="选择表单"]',
  ];
  let ddClicked = false;
  for (const sel of ddSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      await el.click({ force: true });
      await page.waitForTimeout(800);
      ddClicked = true;
      break;
    }
  }
  if (!ddClicked) {
    console.warn(`  [WARN] 未找到数据源下拉: ${fieldName}`);
    return;
  }

  // 选择目标表单
  const entrySelectors = [
    `[class*="popover"] .entry-item:has-text("${sourceFormName}")`,
    `[class*="dropdown"] :text-is("${sourceFormName}")`,
    `[class*="picker"] :text-is("${sourceFormName}")`,
    `:text-is("${sourceFormName}")`,
  ];
  let selected = false;
  for (const sel of entrySelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ force: true });
      await page.waitForTimeout(600);
      selected = true;
      break;
    }
  }
  if (!selected) {
    console.warn(`  [WARN] 未找到表单选项: ${sourceFormName}`);
    return;
  }

  // 保存
  const saveBtn = page.locator("button:has-text('保存')").first();
  if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await saveBtn.click({ force: true });
    await waitForStableDOM(page, 1000);
  }

  console.log(`  ✓ ${fieldName} 已关联 ${sourceFormName}`);
}

async function main() {
  console.log('[STAGE 2] 配置关联数据源\n');
  const wd = startWatchdog({ hardTimeoutMs: 600_000 });
  const s = await launchBrowser();

  try {
    const { page } = s;
    await login(page);

    const ids = loadIds();
    console.log('Form IDs:', ids);

    if (!ids.po || !ids.so) {
      throw new Error('缺少 form IDs，请先运行 stage1_build_forms.ts 或在 .env 中配置');
    }

    const configs: DataSourceConfig[] = [
      // 采购订单：供应商 → 供应商资料
      { formId: ids.po, fieldName: '供应商', sourceFormName: '供应商资料' },
      // 采购明细（子表）：商品 → 商品资料
      { formId: ids.po, fieldName: '商品', sourceFormName: '商品资料', inSubTable: '采购明细' },
      // 采购入库单：关联采购单 → 采购订单
      { formId: ids.receipt, fieldName: '关联采购单', sourceFormName: '采购订单' },
      // 采购入库明细（子表）：商品 → 商品资料
      { formId: ids.receipt, fieldName: '商品', sourceFormName: '商品资料', inSubTable: '入库明细' },
      // 销售订单：客户 → 客户资料
      { formId: ids.so, fieldName: '客户', sourceFormName: '客户资料' },
      // 销售明细（子表）：商品 → 商品资料
      { formId: ids.so, fieldName: '商品', sourceFormName: '商品资料', inSubTable: '销售明细' },
      // 销售出库单：关联销售单 → 销售订单
      { formId: ids.shipment, fieldName: '关联销售单', sourceFormName: '销售订单' },
    ];

    for (const cfg of configs) {
      await configOneField(page, cfg.formId, cfg.fieldName, cfg.sourceFormName, cfg.inSubTable);
    }

    console.log('\n[STAGE 2] 数据源配置完成');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
