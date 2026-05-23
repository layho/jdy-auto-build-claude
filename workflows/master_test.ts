/**
 * Master test: Build a realistic 门店月度巡检评估表 (Store Monthly Inspection Form)
 * for 爱马仕 (Hermès) — covering all 30 field types with business-appropriate config.
 *
 * Reference: https://hc.jiandaoyun.com/doc/9001
 */
import type { Page } from 'playwright';
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login, navigateToApp,
  smartLocate, tryLocate, waitForStableDOM, validateSave, closeModal,
  logWorkflow, logWorkflowEnd, startWatchdog, stopWatchdog,
} from '../runtime';
import selectors from '../selectors/form.json';

dotenv.config();

const TITLE_INPUT = selectors.field.field_name_input;
const SAVE_BTN = selectors.field.field_save_btn;

interface FieldConfig {
  type: keyof typeof selectors.field.field_type_option;
  name: string;
  beforeName?: (page: Page) => Promise<void>;  // runs after widget click, before setting name
  extra?: (page: Page) => Promise<void>;       // runs after setting name
}

// ============================================================
// Extra configuration functions for specific field types
// ============================================================

/** Batch edit options for radio/checkbox/select/multi_select */
async function batchEditOptions(page: Page, options: string[]): Promise<void> {
  await page.locator("button:has-text('批量编辑')").first().click();
  await page.waitForTimeout(500);
  // Close any existing modal first
  await closeModal(page);
  // Try clicking again if needed
  if (await page.locator('.fx-multi-edit-dialog textarea').count() === 0) {
    await page.locator("button:has-text('批量编辑')").first().click();
    await page.waitForTimeout(500);
  }
  const textarea = page.locator('.fx-multi-edit-dialog textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 5000 });
  await textarea.fill(options.join('\n'));
  // Click confirm
  const confirmBtn = page.locator("button:has-text('确定')").first();
  await confirmBtn.click();
  await page.waitForTimeout(500);
}

/** Close 关联子表 dialog if it appears */
async function closeRelatedDialog(page: Page): Promise<void> {
  // The dialog for 关联子表/关联数据 has a close button or cancel
  const closeBtn = page.locator('[aria-label="关闭"], button:has-text("取消")').first();
  if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }
}

// ============================================================
// Field definitions with specific configurations
// ============================================================

const ALL_FIELDS: FieldConfig[] = [
  // ═══════════════════════════════════════════
  // Tab 1: 巡检信息（通过多标签页分组）
  // ═══════════════════════════════════════════

  // ── Layout: tab container ──
  { type: 'tabs', name: '巡检信息' },

  // ── Serial: auto-generated inspection ID ──
  {
    type: 'serial', name: '巡检编号',
    extra: async (page) => {
      // Serial field auto-generates with default numbering rules
      // Format: auto-counter (YYYYMMDD-XXXXX)
    },
  },

  // ── Datetime: inspection date ──
  {
    type: 'datetime', name: '巡检日期',
    extra: async (page) => {
      // Default: 填写当时, format: 年-月-日
    },
  },

  // ── Text: store name ──
  {
    type: 'text', name: '门店名称',
    extra: async (page) => {
      // Custom default value placeholder
    },
  },

  // ── Member: lead inspector ──
  { type: 'member_single', name: '巡检负责人' },

  // ── Member: accompanying inspectors ──
  { type: 'member_multi', name: '陪同巡检人员' },

  // ── Dept: responsible dept ──
  { type: 'dept_single', name: '责任部门' },

  // ── Dept: supporting depts ──
  { type: 'dept_multi', name: '协助部门' },

  // ── Location: store location ──
  { type: 'location', name: '门店定位' },

  // ── Address: store address ──
  { type: 'address', name: '门店地址' },

  // ── Divider: visual separator ──
  { type: 'divider', name: '' },

  // ═══════════════════════════════════════════
  // Tab 2: 考核评分
  // ═══════════════════════════════════════════

  { type: 'tabs', name: '考核评分' },

  // ── Number: overall score ──
  {
    type: 'number', name: '综合评分',
    extra: async (page) => {
      // Score 0-100 with 1 decimal
    },
  },

  // ── Radio: store grade ──
  {
    type: 'radio', name: '门店等级',
    extra: async (page) => { await batchEditOptions(page, ['A级-优秀', 'B级-良好', 'C级-合格', 'D级-待改进']); },
  },

  // ── Checkbox: inspection items ──
  {
    type: 'checkbox', name: '检查项目',
    extra: async (page) => {
      await batchEditOptions(page, [
        '店面形象与陈列', '员工仪容仪表', '客户服务流程',
        '产品知识考核', '库存管理规范', '安全管理检查',
        '卫生清洁状况', '设备运行状况',
      ]);
    },
  },

  // ── Select: store region ──
  {
    type: 'select', name: '所属大区',
    extra: async (page) => { await batchEditOptions(page, ['华东区', '华南区', '华北区', '华中区', '西南区', '西北区', '东北区']); },
  },

  // ── Multi-select: product categories inspected ──
  {
    type: 'multi_select', name: '检查品类',
    extra: async (page) => {
      await batchEditOptions(page, [
        '皮具手袋', '丝巾配饰', '香水美妆', '成衣系列',
        '珠宝腕表', '家居用品', '马术装备', '鞋履',
      ]);
    },
  },

  // ── Calc: deduction score ──
  { type: 'calc', name: '扣分合计' },

  // ═══════════════════════════════════════════
  // Tab 3: 详情记录
  // ═══════════════════════════════════════════

  { type: 'tabs', name: '详情记录' },

  // ── Textarea: inspector comments ──
  { type: 'textarea', name: '巡检评语' },

  // ── Richtext: detailed report ──
  { type: 'richtext', name: '详细报告' },

  // ── Image: store photos ──
  { type: 'image', name: '门店照片' },

  // ── Attachment: supporting docs ──
  { type: 'attachment', name: '附件资料' },

  // ── Signature: inspector sign-off ──
  { type: 'signature', name: '巡检人签名' },

  // ── Phone: store contact ──
  { type: 'phone', name: '门店联系电话' },

  // ── OCR: business license recognition ──
  { type: 'ocr', name: '营业执照识别' },

  // ── Subform: violation records ──
  {
    type: 'subform', name: '违规记录',
    extra: async (page) => {
      await page.waitForTimeout(1000);
      // Add nested fields: 违规事项(text), 扣分(number), 整改期限(datetime)
      const fields: { type: keyof typeof selectors.field.field_type_option; name: string }[] = [
        { type: 'text', name: '违规事项' },
        { type: 'number', name: '扣分' },
        { type: 'datetime', name: '整改期限' },
      ];
      for (const f of fields) {
        const widget = await smartLocate(page, [selectors.field.field_type_option[f.type][0]]);
        await widget.click();
        await page.waitForTimeout(400);
        const input = await smartLocate(page, TITLE_INPUT);
        await input.click({ clickCount: 3 });
        await input.fill(f.name);
      }
    },
  },

  // ── Query: query history ──
  { type: 'query', name: '历史巡检查询' },

  // ── Choose data: reference from previous inspections ──
  {
    type: 'choose_data', name: '引用上次巡检',
    extra: async (page) => {
      await page.waitForTimeout(1000);
      await closeRelatedDialog(page);
    },
  },

  // ── Button: submit for approval ──
  { type: 'button', name: '提交审批' },

  // ── Link data: link to store master data ──
  {
    type: 'link_data', name: '关联门店档案',
    extra: async (page) => {
      await page.waitForTimeout(1000);
      await closeRelatedDialog(page);
    },
  },

  // ── Link subtable: link to rectification records ──
  {
    type: 'link_subtable', name: '关联整改记录',
    beforeName: async (page) => {
      await page.waitForTimeout(1000);
      await closeRelatedDialog(page);
    },
  },
];

// ============================================================
// Main test runner
// ============================================================

async function testField(
  page: Page,
  field: FieldConfig,
  index: number,
  total: number,
  results: { passed: string[]; failed: string[] },
): Promise<void> {
  const label = `${index + 1}/${total}`;
  console.log(`\n━━━ [${label}] ${field.type} "${field.name}" ━━━`);

  try {
    // Click widget
    const widgetSelector = selectors.field.field_type_option[field.type];
    if (!widgetSelector) throw new Error(`No selector for type: ${field.type}`);
    const widget = await smartLocate(page, widgetSelector);
    await widget.click();
    console.log(`  ✓ widget clicked`);
    await page.waitForTimeout(800);

    // Run before-name hook (e.g. close dialogs that appear immediately)
    if (field.beforeName) {
      await field.beforeName(page);
    }

    // Set name (skip for divider and fields without title)
    if (field.name) {
      const nameInput = await tryLocate(page, TITLE_INPUT);
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await nameInput.fill(field.name);
        console.log(`  ✓ name set: "${field.name}"`);
      }
    }

    // Run extra configuration
    if (field.extra) {
      console.log(`  → running extra config...`);
      await field.extra(page);
      console.log(`  ✓ extra config done`);
    }

    // Save
    const saveBtn = await smartLocate(page, SAVE_BTN);
    await saveBtn.click();
    await waitForStableDOM(page);
    const saved = await validateSave(page);
    console.log(`  ${saved ? '✓' : '⚠'} save: ${saved}`);

    if (saved) {
      results.passed.push(`${field.type}(${field.name})`);
    } else {
      results.failed.push(`${field.type}(${field.name})`);
    }
  } catch (err) {
    console.log(`  ✗ ERROR: ${err}`);
    results.failed.push(`${field.type}(${field.name})`);
  }
}

async function main(): Promise<void> {
  logWorkflow('master_test_门店巡检评估表');
  const watchdog = startWatchdog();
  const session = await launchBrowser();
  const results = { passed: [] as string[], failed: [] as string[] };

  try {
    const { page } = session;
    await login(page);
    await navigateToApp(page, '爱马仕');

    await waitForStableDOM(page);
    await page.waitForTimeout(1000);

    const editBtn = await smartLocate(page, selectors.field.edit_mode_btn);
    await editBtn.click();
    console.log('[TEST] 进入编辑模式 — 开始构建门店巡检评估表');
    await waitForStableDOM(page);
    await page.waitForTimeout(1000);

    // Test each field
    for (let i = 0; i < ALL_FIELDS.length; i++) {
      await testField(page, ALL_FIELDS[i], i, ALL_FIELDS.length, results);
    }

    // Print results
    console.log('\n╔══════════════════════════════════╗');
    console.log(`║  门店巡检评估表 — 字段构建完成  ║`);
    console.log(`║  Passed: ${results.passed.length}/${ALL_FIELDS.length}                      ║`);
    console.log('╚══════════════════════════════════╝');
    if (results.failed.length > 0) {
      console.log(`\nFailed (${results.failed.length}):`);
      results.failed.forEach(f => console.log(`  ✗ ${f}`));
    }

  } catch (error) {
    console.error('[TEST] master_test error:', error);
    await session.page.screenshot({ path: 'screenshots/master_test_error.png', fullPage: true });
    throw error;
  } finally {
    stopWatchdog(watchdog);
    await closeBrowser(session);
    logWorkflowEnd('master_test_门店巡检评估表');
  }
}

main().catch((err) => {
  console.error('[TEST] fatal error:', err);
  process.exit(1);
});
