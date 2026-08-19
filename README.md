# utools_plugins_converter

> 格式转换套件 — uTools 插件

## 功能

- **9 种格式互转**：JSON / YAML / TOML / XML / CSV / Markdown / XLSX / MySQL / SparkSQL（以 JSON 数组为中心枢纽）
- **双向转换**：任意两种格式间互转
- **预览编辑**：类似 Excel 的内联编辑（修改单元格、重命名列、增删行），输出实时更新
- **表格预览**：横向/纵向切换、关键词搜索、一键复制到 Excel
- **自动检测**：智能识别源格式
- **多 Tab**：支持多个转换任务并行
- **字段类型配置**：MySQL/HiveSQL 列类型手动覆盖

## 技术栈

- React 19 + Vite 6
- 共享包：`@ztools/ui-kit`（设计系统）

## 开发

```bash
npm install
npm run dev    # 开发服务器 http://localhost:5180
npm run build  # 生产构建
npm test       # 运行测试（186 个）
```

## 安装到 uTools

1. `npm run build` 生成 `dist/`
2. 将 `dist/plugin.json` 拖入 uTools 开发者工具

## 使用

- 关键词 `converter` / `格式转换` / `json转换` / `yaml` / `csv` 等打开主界面
- 选择源格式和目标格式 → 粘贴或导入数据 → 实时预览转换结果
- 在预览表格中直接编辑数据，输出自动更新
