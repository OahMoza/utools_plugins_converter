// formatOptions.js —— 格式相关的纯数据与纯函数（供组件与测试共享）
// 该模块不含 JSX，可被 node:test 与 Vite 同时加载。

/** 全部支持的格式，顺序即 UI 展示顺序 */
export const FORMATS = ['json', 'yaml', 'toml', 'xml', 'csv', 'markdown', 'xlsx', 'mysql', 'sparksql']

/** 每种格式的短标签（用于下拉选项） */
export const FORMAT_LABELS = {
  json: { short: 'JSON' },
  yaml: { short: 'YAML' },
  toml: { short: 'TOML' },
  xml: { short: 'XML' },
  csv: { short: 'CSV' },
  xlsx: { short: 'XLSX' },
  markdown: { short: 'MD' },
  mysql: { short: 'MySQL' },
  sparksql: { short: 'HiveSQL' }
}

/**
 * 根据目标格式返回对应的选项 schema（纯函数）。
 * 每项描述一个选项：key / label / type ('select'|'text'|'switch') / options(仅 select)。
 * @param {string} format 目标格式
 * @returns {Array} 选项 schema 数组
 */
export function getOptionsForFormat(format) {
  switch (format) {
    case 'yaml':
      return [
        { key: 'indent', label: '缩进', type: 'select', options: [{ label: '2 空格', value: 2 }, { label: '4 空格', value: 4 }] }
      ]
    case 'csv':
      return [
        { key: 'delimiter', label: '分隔符', type: 'select', options: [{ label: '逗号', value: ',' }, { label: '分号', value: ';' }, { label: '制表符', value: '\t' }] },
        { key: 'header', label: '表头', type: 'switch' }
      ]
    case 'markdown':
      return [
        { key: 'alignment', label: '对齐', type: 'select', options: [{ label: '左对齐', value: 'left' }, { label: '居中', value: 'center' }, { label: '右对齐', value: 'right' }] }
      ]
    case 'mysql':
      return [
        { key: 'database', label: '数据库', type: 'text' },
        { key: 'tableName', label: '表名', type: 'text' },
        { key: 'batchMode', label: '批量模式', type: 'switch' },
        {
          key: 'nullHandling', label: 'NULL处理', type: 'select', options: [
            { label: 'NULL (无引号)', value: 'NULL' },
            { label: '空字符串', value: 'empty_string' },
            { label: '跳过该列', value: 'skip_column' }
          ]
        },
        { key: 'includeCreateTable', label: '包含建表语法', type: 'switch' }
      ]
    case 'sparksql':
      return [
        { key: 'database', label: '数据库', type: 'text' },
        { key: 'tableName', label: '表名', type: 'text' },
        { key: 'writeMode', label: '写入模式', type: 'select', options: [{ label: 'INSERT INTO', value: 'into' }, { label: 'INSERT OVERWRITE', value: 'overwrite' }] },
        { key: 'batchMode', label: '批量模式', type: 'switch' },
        { key: 'partitionMode', label: '分区模式', type: 'select', options: [{ label: '静态分区', value: 'static' }, { label: '动态分区', value: 'dynamic' }] },
        { key: 'staticPartition', label: '静态分区表达式', type: 'text' },
        { key: 'partitionColumns', label: '动态分区列', type: 'text' },
        { key: 'includeCreateTable', label: '包含建表语法', type: 'switch' }
      ]
    case 'toml':
      return [{ key: 'wrapper', label: '包装字段', type: 'text' }]
    case 'xml':
      return [
        { key: 'rootName', label: '根节点', type: 'text' },
        { key: 'itemName', label: '数组项', type: 'text' }
      ]
    default:
      return []
  }
}
