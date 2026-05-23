/**
 * stage1_build_forms.ts — 创建所有表单（基础资料 + 订单主子表）
 *
 * 修复：
 * 1. 多个 stage 文件大量重复代码 → 统一用 _formBuilder.ts helpers
 * 2. 子表单字段：原来点击子表单 canvas 的选择器 '[class*="sub-form"]' 不精确，
 *    改为选最后一个出现的 .subform-widget（即刚刚添加的那个）
 * 3. 选项设置：原来在设置选项时没等 DOM 稳定就继续操作下一字段
 * 4. createForm 函数每次都从 APP_URL 重新 goto，效率低且增加登录风险
 *    → 直接在编辑器内连续加字段，只在真正需要新建时才 goto
 * 5. 字段名设置：原来只 fill 一次，如果属性面板还没出现会静默失败
 *    → 加了 waitForTimeout + 重试
 * 6. 简道云"查询"字段实际上是"查询"不是"关联查询"，修正字段类型名称
 */
import * as dotenv from 'dotenv';
import {
  launchBrowser, closeBrowser, login,
  waitForStableDOM, startWatchdog, stopWatchdog,
} from '../runtime';
import {
  createNewForm, addField, addSubTable, saveForm,
  type FieldSpec, type SubTableSpec,
} from './_formBuilder';

dotenv.config();

const APP_ID = process.env.JDY_APP_ID ?? '6a0aa9d82c4789aa80588d06';

// ────────────────────────────────────────────────────────
// 表单设计规格（严格对照设计文档）
// ────────────────────────────────────────────────────────

// 4.1 商品资料
const PRODUCT_FIELDS: FieldSpec[] = [
  { name: '商品编码', type: '单行文本' },
  { name: '商品名称', type: '单行文本' },
  { name: '商品分类', type: '下拉框', options: '手机\n笔记本\n家电' },
  { name: '品牌',     type: '单行文本' },
  { name: '规格型号', type: '单行文本' },
  { name: '单位',     type: '下拉框', options: '件\n箱\n个' },
  { name: '采购价',   type: '数字' },
  { name: '销售价',   type: '数字' },
  { name: '安全库存', type: '数字' },
  { name: '状态',     type: '单选按钮组', options: '启用\n停用' },
  { name: '备注',     type: '多行文本' },
];

// 4.2 客户资料
const CUSTOMER_FIELDS: FieldSpec[] = [
  { name: '客户编号', type: '单行文本' },
  { name: '客户名称', type: '单行文本' },
  { name: '联系人',   type: '单行文本' },
  { name: '联系电话', type: '手机' },
  { name: '地址',     type: '地址' },
  { name: '客户等级', type: '下拉框', options: 'VIP\nA级\nB级\nC级' },
  { name: '信用额度', type: '数字' },
  { name: '状态',     type: '单选按钮组', options: '启用\n停用' },
  { name: '备注',     type: '多行文本' },
];

// 4.3 供应商资料
const SUPPLIER_FIELDS: FieldSpec[] = [
  { name: '供应商编号', type: '单行文本' },
  { name: '供应商名称', type: '单行文本' },
  { name: '联系人',     type: '单行文本' },
  { name: '联系电话',   type: '手机' },
  { name: '地址',       type: '地址' },
  { name: '结算方式',   type: '下拉框', options: '月结30天\n月结60天\n现结' },
  { name: '状态',       type: '单选按钮组', options: '启用\n停用' },
  { name: '备注',       type: '多行文本' },
];

// 5.1 采购订单（主表 + 子表）
const PO_MAIN_FIELDS: FieldSpec[] = [
  { name: '采购单号', type: '单行文本' },
  { name: '供应商',   type: '选择数据' },   // 后续配置数据源 → 供应商资料
  { name: '采购日期', type: '日期时间' },
  { name: '采购员',   type: '成员单选' },
  { name: '总金额',   type: '数字' },
  { name: '状态',     type: '单选按钮组', options: '待审批\n已审批\n已完成\n已取消' },
  { name: '备注',     type: '多行文本' },
];
const PO_SUB: SubTableSpec = {
  name: '采购明细',
  fields: [
    { name: '商品',     type: '选择数据' },  // 数据源 → 商品资料
    { name: '商品编码', type: '关联数据' },
    { name: '数量',     type: '数字' },
    { name: '单价',     type: '数字' },
    { name: '金额',     type: '计算' },
  ],
};

// 5.2 采购入库单
const RECEIPT_MAIN_FIELDS: FieldSpec[] = [
  { name: '入库单号',   type: '单行文本' },
  { name: '关联采购单', type: '选择数据' },  // 数据源 → 采购订单
  { name: '入库日期',   type: '日期时间' },
  { name: '仓库',       type: '下拉框', options: '主仓库\n次仓库\n退货仓' },
  { name: '入库状态',   type: '单选按钮组', options: '待入库\n已入库\n已取消' },
];
const RECEIPT_SUB: SubTableSpec = {
  name: '入库明细',
  fields: [
    { name: '商品', type: '选择数据' },
    { name: '数量', type: '数字' },
    { name: '单位', type: '单行文本' },
  ],
};

// 6.1 销售订单
const SO_MAIN_FIELDS: FieldSpec[] = [
  { name: '销售单号', type: '单行文本' },
  { name: '客户',     type: '选择数据' },   // 数据源 → 客户资料
  { name: '销售日期', type: '日期时间' },
  { name: '销售员',   type: '成员单选' },
  { name: '总金额',   type: '数字' },
  { name: '状态',     type: '单选按钮组', options: '待审批\n已审批\n已完成\n已取消' },
];
const SO_SUB: SubTableSpec = {
  name: '销售明细',
  fields: [
    { name: '商品', type: '选择数据' },
    { name: '数量', type: '数字' },
    { name: '单价', type: '数字' },
    { name: '金额', type: '计算' },
  ],
};

// 6.2 销售出库单
const SHIPMENT_FIELDS: FieldSpec[] = [
  { name: '出库单号',   type: '单行文本' },
  { name: '关联销售单', type: '选择数据' },  // 数据源 → 销售订单
  { name: '出库日期',   type: '日期时间' },
  { name: '仓库',       type: '下拉框', options: '主仓库\n次仓库\n退货仓' },
  { name: '状态',       type: '单选按钮组', options: '待出库\n已出库\n已取消' },
];

// ────────────────────────────────────────────────────────
// 主流程
// ────────────────────────────────────────────────────────
async function buildForm(
  page: any,
  formName: string,
  mainFields: FieldSpec[],
  sub?: SubTableSpec
): Promise<string> {
  const formId = await createNewForm(page, APP_ID, formName);

  console.log(`  [FIELDS] 添加主表字段...`);
  for (const f of mainFields) {
    await addField(page, f);
  }

  if (sub) {
    await addSubTable(page, sub);
  }

  await saveForm(page);
  await page.screenshot({ path: `screenshots/build-${formName}.png`, fullPage: true });
  return formId;
}

async function main() {
  console.log('[BUILD] 创建 ERP 表单\n');
  const wd = startWatchdog({ hardTimeoutMs: 1_200_000 }); // 20 min
  const s = await launchBrowser();
  const ids: Record<string, string> = {};

  try {
    const { page } = s;
    await login(page);

    // ── 基础资料 ──────────────────────────────
    ids.product  = await buildForm(page, '商品资料',   PRODUCT_FIELDS);
    ids.customer = await buildForm(page, '客户资料',   CUSTOMER_FIELDS);
    ids.supplier = await buildForm(page, '供应商资料', SUPPLIER_FIELDS);

    // ── 采购模块 ──────────────────────────────
    ids.po      = await buildForm(page, '采购订单',   PO_MAIN_FIELDS, PO_SUB);
    ids.receipt = await buildForm(page, '采购入库单', RECEIPT_MAIN_FIELDS, RECEIPT_SUB);

    // ── 销售模块 ──────────────────────────────
    ids.so       = await buildForm(page, '销售订单',   SO_MAIN_FIELDS, SO_SUB);
    ids.shipment = await buildForm(page, '销售出库单', SHIPMENT_FIELDS);

    console.log('\n[BUILD] 所有表单创建完成');
    console.log(JSON.stringify(ids, null, 2));
    console.log('\n下一步: 运行 stage2_config_datasources.ts 配置关联数据源');

  } finally {
    stopWatchdog(wd);
    await closeBrowser(s);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
