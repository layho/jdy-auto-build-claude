# jdy-auto-build-claude

简道云自动化构建学习项目 — 通过 Playwright + TypeScript E2E 测试完全掌握简道云所有功能模块。

## 目标

完全掌握简道云的使用。通过实战 E2E 自动化测试覆盖所有功能模块，记录每个模块的交互模式、DOM 结构和踩坑经验。

## 运行

```bash
npx tsx workflows/<script>.ts
```

浏览器会话保存在 `.temp/session.json`，首次运行会登录，后续跳过。

## 项目结构

```
.env                    # JDY_USERNAME / JDY_PASSWORD
runtime/                # browser.ts(浏览器/登录), dom.ts(waitForStableDOM), watchdog.ts
selectors/form.json     # 登录页选择器
workflows/              # 各阶段的自动化脚本
  master_phase*.ts      # 主线脚本
  diag_*.ts             # 诊断/探索脚本
memory/                 # 学习笔记
  project_jiandaoyun_agent_learnings.md  # 完整的 DOM 交互模式和模块文档
screenshots/            # 运行截图
```

## 当前进度（2026-05-23）

### 已完成
- 表单创建与配置（字段添加、属性设置、发布）
- 关联数据 / 关联子表 / 选择数据 配置
- 子表单 E2E 测试（完整提交流程通过）
- 权限设置（表单权限组配置）
- 聚合表：清理 13 个垃圾表，创建"订单销量统计"（含 CodeMirror 公式编辑器交互）
- 智能助手 Pro：触发(表单触发:订单管理, 新增数据时) → 新增数据到产品信息，5字段完整映射
- 仪表盘：创建"订单数据概览"，含统计表(维度=下单日期, 指标=订单编号)和明细表
- 数据工厂：创建数据流，输入源=订单管理，含字段设置处理节点
- 流程表单：创建"请假申请"流程表单，含3个字段，已进入流程设定
- 前端事件：探索了扩展功能页面，前端事件需通过开放平台/插件系统配置

### 进行中
- 全部主线任务已完成

### 待完成
- 前端事件实际配置（需开放平台权限）
- 流程表单审批流深入配置

## 关键 DOM 模式

- **点击事件**: 简道云使用 Vue 框架，基本UI操作需用 Playwright `click({ force: true })`。但 **Vue 组件的保存按钮** 需用 `evaluate(el.click())`，Playwright click 无法触发 Vue 事件处理器
- **确认弹窗**: `.fx-nav-message` / `.message` 组件，不是标准 `.dialog`
- **表单选择**: `.x-biz-dropdown-label` 点击 → popover `.entry-item` 选择
- **SPA 路由**: URL hash 模式，如 `#/app_aggregate`、`#/app_trigger`
- **CodeMirror**: 公式编辑需从树插入 token，不能直接输入文本
- **多选下拉提交**: `.x-select-multiple` 选中选项后需用 Escape 关闭下拉框才会提交变更到数据模型
- **保存按钮**: 需 `page.evaluate(() => { document.querySelectorAll('button')...click() })` 而非 Playwright click

## 应用信息

- App ID: `6a0aa9d82c4789aa80588d06`
- 表单: 客户信息, 产品信息, 订单管理(含子表订单明细表), 请假申请(流程表单)
- 聚合表: 订单销量统计
- 智能助手: 自动同步订单数据 (automation ID: `6a110c3d63fbb50f9e104db2`)
- 仪表盘: 订单数据概览 (dash ID: `6a11454f095da905f00ef01a`)
- 数据流: ETL ID `6a11471247db01e0c4749e46`

## 新增 DOM 模式 (Phases 25-28)

- **应用菜单创建**: `.menu-tool button.add-button` → `evaluate(el.click())` → popover `.x-menu-item` 选择新建类型
- **仪表盘配置**: 左侧 `fx-etl-config-menu` 拖拽图表类型 → 数据源弹窗选表单 → 拖拽字段到维度/指标区
- **仪表盘字段拖拽**: `.dash-source-field` dragTo `.fx-dash-editor-main-axis-line`
- **数据工厂输入配置**: 点击 canvas 节点 → 底部弹出面板 `.etl-entry-select-panel` → 选表单 → 对话框选字段
- **数据工厂节点拖拽**: SVG `.fx-flow-chart-edges` 会拦截 pointer events，需先设置 `pointer-events: none`
- **流程表单**: 与普通表单区别在于有「流程设定」tab，切换 tab 时可能出现"是否保存"对话框
