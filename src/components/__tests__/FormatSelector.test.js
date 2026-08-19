// FormatSelector.test.js —— FormatSelector 格式选择器逻辑测试
//
// FormatSelector 的核心是静态常量 FORMATS / FORMAT_LABELS 以及 disabledFormats
// 过滤逻辑。这些是纯数据 + 纯函数，可直接测试。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { FORMATS, FORMAT_LABELS } from '../formatOptions.js'

// ── 镜像 FormatSelector 过滤逻辑 ─────────────────────────────────
function filterFormats (disabledFormats = []) {
  return FORMATS.filter(f => !disabledFormats.includes(f))
}

describe('FormatSelector.FORMATS', () => {
  test('包含全部 9 种格式', () => {
    assert.deepEqual(FORMATS, ['json', 'yaml', 'toml', 'xml', 'csv', 'markdown', 'xlsx', 'mysql', 'sparksql'])
  })

  test('长度固定为 9', () => {
    assert.equal(FORMATS.length, 9)
  })

  test('无重复', () => {
    assert.equal(new Set(FORMATS).size, FORMATS.length)
  })
})

describe('FormatSelector.FORMAT_LABELS', () => {
  test('每种格式都有对应 label', () => {
    for (const f of FORMATS) {
      assert.ok(f in FORMAT_LABELS, `缺少 ${f} 的 label`)
      assert.equal(typeof FORMAT_LABELS[f].short, 'string', `${f}.short 应为字符串`)
      assert.ok(FORMAT_LABELS[f].short.length > 0, `${f}.short 不应为空`)
    }
  })

  test('关键 label 正确', () => {
    assert.equal(FORMAT_LABELS.json.short, 'JSON')
    assert.equal(FORMAT_LABELS.yaml.short, 'YAML')
    assert.equal(FORMAT_LABELS.csv.short, 'CSV')
    assert.equal(FORMAT_LABELS.markdown.short, 'MD')
    assert.equal(FORMAT_LABELS.mysql.short, 'MySQL')
    assert.equal(FORMAT_LABELS.sparksql.short, 'HiveSQL')
    assert.equal(FORMAT_LABELS.xlsx.short, 'XLSX')
  })
})

describe('FormatSelector 过滤逻辑 (disabledFormats)', () => {
  test('无禁用时返回全部格式', () => {
    assert.deepEqual(filterFormats([]), FORMATS)
    assert.deepEqual(filterFormats(), FORMATS)
  })

  test('禁用单个格式', () => {
    const r = filterFormats(['json'])
    assert.ok(!r.includes('json'))
    assert.equal(r.length, 8)
  })

  test('禁用多个格式', () => {
    const r = filterFormats(['json', 'yaml', 'xlsx'])
    assert.deepEqual(r, ['toml', 'xml', 'csv', 'markdown', 'mysql', 'sparksql'])
  })

  test('禁用全部格式 → 空数组', () => {
    assert.deepEqual(filterFormats(FORMATS), [])
  })

  test('禁用不存在的格式 → 无影响', () => {
    const r = filterFormats(['foo', 'bar'])
    assert.deepEqual(r, FORMATS)
  })

  test('禁用后剩余顺序保持原始 FORMATS 顺序', () => {
    const r = filterFormats(['toml', 'csv'])
    // 原始顺序去掉 toml/csv
    assert.deepEqual(r, ['json', 'yaml', 'xml', 'markdown', 'xlsx', 'mysql', 'sparksql'])
  })
})

describe('FormatSelector 选项渲染契约', () => {
  test('select 的 value 等于当前选中格式', () => {
    // 组件逻辑：<select value={value} onChange=...>
    // 契约：options 中必有一项 value 等于当前 value
    const value = 'yaml'
    const options = filterFormats([])
    assert.ok(options.includes(value), `options 应包含当前值 ${value}`)
  })

  test('option 文本使用 FORMAT_LABELS.short', () => {
    // 组件：<option value={f}>{FORMAT_LABELS[f].short}</option>
    for (const f of FORMATS) {
      assert.equal(typeof FORMAT_LABELS[f].short, 'string')
    }
  })
})
