// OptionsPanel.test.js —— OptionsPanel 选项渲染逻辑测试
//
// OptionsPanel 的核心是按「目标格式」返回对应的选项 schema。该逻辑是纯函数，
// 抽成命名导出 getOptionsForFormat 后可直接测试，覆盖全部 9 种格式。
//
// 测试目标：
//   - 每种已知格式返回正确的选项 key / label / type / 子选项
//   - 未知格式返回空数组
//   - 组件契约：options 为空时不渲染（返回 null）→ 由 formatOptions.length===0 判定
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getOptionsForFormat } from '../formatOptions.js'

// ── 工具：断言一个 option 结构 ───────────────────────────────────
function assertOption (opt, { key, label, type }) {
  assert.equal(opt.key, key, `key 应为 ${key}`)
  assert.equal(opt.label, label, `label 应为 ${label}`)
  assert.equal(opt.type, type, `type 应为 ${type}`)
}

describe('OptionsPanel.getOptionsForFormat', () => {
  test('yaml: 缩进选项（2/4 空格）', () => {
    const opts = getOptionsForFormat('yaml')
    assert.equal(opts.length, 1)
    assertOption(opts[0], { key: 'indent', label: '缩进', type: 'select' })
    assert.deepEqual(opts[0].options, [
      { label: '2 空格', value: 2 },
      { label: '4 空格', value: 4 }
    ])
  })

  test('csv: 分隔符（3 项）+ 表头开关', () => {
    const opts = getOptionsForFormat('csv')
    assert.equal(opts.length, 2)
    assertOption(opts[0], { key: 'delimiter', label: '分隔符', type: 'select' })
    assert.equal(opts[0].options.length, 3)
    assert.deepEqual(opts[0].options.map(o => o.value), [',', ';', '\t'])
    assertOption(opts[1], { key: 'header', label: '表头', type: 'switch' })
  })

  test('markdown: 对齐选项（左/中/右）', () => {
    const opts = getOptionsForFormat('markdown')
    assert.equal(opts.length, 1)
    assertOption(opts[0], { key: 'alignment', label: '对齐', type: 'select' })
    assert.deepEqual(opts[0].options.map(o => o.value), ['left', 'center', 'right'])
  })

  test('mysql: 5 项（database/tableName/batchMode/nullHandling/includeCreateTable）', () => {
    const opts = getOptionsForFormat('mysql')
    assert.equal(opts.length, 5)
    const keys = opts.map(o => o.key)
    assert.deepEqual(keys, ['database', 'tableName', 'batchMode', 'nullHandling', 'includeCreateTable'])
    // text 类型
    assert.equal(opts[0].type, 'text')
    assert.equal(opts[1].type, 'text')
    // switch 类型
    assert.equal(opts[2].type, 'switch')
    // nullHandling select 含 3 个值
    assert.equal(opts[3].type, 'select')
    assert.deepEqual(opts[3].options.map(o => o.value), ['NULL', 'empty_string', 'skip_column'])
    assert.equal(opts[4].type, 'switch')
  })

  test('sparksql: 8 项（database/tableName/writeMode/batchMode/partitionMode/staticPartition/partitionColumns/includeCreateTable）', () => {
    const opts = getOptionsForFormat('sparksql')
    assert.equal(opts.length, 8)
    const keys = opts.map(o => o.key)
    assert.deepEqual(keys, [
      'database', 'tableName', 'writeMode', 'batchMode',
      'partitionMode', 'staticPartition', 'partitionColumns', 'includeCreateTable'
    ])
    // writeMode 值
    const writeMode = opts.find(o => o.key === 'writeMode')
    assert.deepEqual(writeMode.options.map(o => o.value), ['into', 'overwrite'])
    // partitionMode 值
    const partMode = opts.find(o => o.key === 'partitionMode')
    assert.deepEqual(partMode.options.map(o => o.value), ['static', 'dynamic'])
  })

  test('toml: 包装字段（text）', () => {
    const opts = getOptionsForFormat('toml')
    assert.equal(opts.length, 1)
    assertOption(opts[0], { key: 'wrapper', label: '包装字段', type: 'text' })
  })

  test('xml: rootName + itemName（text）', () => {
    const opts = getOptionsForFormat('xml')
    assert.equal(opts.length, 2)
    assertOption(opts[0], { key: 'rootName', label: '根节点', type: 'text' })
    assertOption(opts[1], { key: 'itemName', label: '数组项', type: 'text' })
  })

  test('json / xlsx: 无选项（→ 组件返回 null）', () => {
    assert.deepEqual(getOptionsForFormat('json'), [])
    assert.deepEqual(getOptionsForFormat('xlsx'), [])
  })

  test('未知格式返回空数组', () => {
    assert.deepEqual(getOptionsForFormat('foo'), [])
    assert.deepEqual(getOptionsForFormat(''), [])
    assert.deepEqual(getOptionsForFormat(undefined), [])
    assert.deepEqual(getOptionsForFormat(null), [])
  })

  test('所有选项的 key 在同一格式内唯一', () => {
    const formats = ['yaml', 'csv', 'markdown', 'mysql', 'sparksql', 'toml', 'xml']
    for (const f of formats) {
      const keys = getOptionsForFormat(f).map(o => o.key)
      assert.equal(new Set(keys).size, keys.length, `格式 ${f} 的 option key 应唯一`)
    }
  })

  test('select 类型必须携带非空 options 数组', () => {
    const formats = ['yaml', 'csv', 'markdown', 'mysql', 'sparksql']
    for (const f of formats) {
      const selects = getOptionsForFormat(f).filter(o => o.type === 'select')
      for (const s of selects) {
        assert.ok(Array.isArray(s.options) && s.options.length > 0,
          `格式 ${f} 的 select ${s.key} 必须包含 options`)
        for (const o of s.options) {
          assert.ok('label' in o && 'value' in o, 'select 子项必须含 label 与 value')
        }
      }
    }
  })

  test('契约：formatOptions.length===0 时组件不渲染（返回 null）', () => {
    // 组件逻辑：if (formatOptions.length === 0) return null
    // 这里用纯函数镜像该判定
    function shouldRender (format) {
      return getOptionsForFormat(format).length > 0
    }
    assert.equal(shouldRender('json'), false)
    assert.equal(shouldRender('xlsx'), false)
    assert.equal(shouldRender('yaml'), true)
    assert.equal(shouldRender('mysql'), true)
  })
})
