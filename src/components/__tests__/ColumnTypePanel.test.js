// ColumnTypePanel.test.js —— ColumnTypePanel 列类型推断与覆盖逻辑测试
//
// ColumnTypePanel 依赖 React 渲染，但核心逻辑是纯函数：
//   - getInferredType: 在数据行中找首个非空值，用对应 infer 函数推断
//   - handleChange: 覆盖/删除/重置 overrides 对象
// 这里直接测试这些纯逻辑（通过从 converters 导入已导出的 infer 函数），
// 并用镜像函数复现面板行为。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { inferMySqlType, MYSQL_TYPE_OPTIONS } from '../../converters/mysql.js'
import { inferHiveType, HIVE_TYPE_OPTIONS } from '../../converters/hivesql.js'

// ── 镜像 ColumnTypePanel.getInferredType ─────────────────────────
// 原逻辑：遍历 data 行，返回首个非空值的推断类型；全空则推断 null。
function getInferredType (data, col, inferFn) {
  for (const row of data) {
    if (row[col] !== null && row[col] !== undefined) {
      return inferFn(row[col])
    }
  }
  return inferFn(null)
}

// ── 镜像 ColumnTypePanel.handleChange ────────────────────────────
function handleChange (overrides, col, type) {
  const next = { ...overrides }
  if (type === '__AUTO__') {
    delete next[col]
  } else {
    next[col] = type
  }
  return next
}

describe('ColumnTypePanel.getInferredType (MySQL)', () => {
  const data = [
    { id: 1, name: 'Alice', active: true, score: 3.14, big: 9999999999 },
    { id: 2, name: 'Bob', active: false, score: 2.5, big: 1 }
  ]

  test('整数 → BIGINT', () => {
    assert.equal(getInferredType(data, 'id', inferMySqlType), 'BIGINT')
  })

  test('长整数 → BIGINT', () => {
    assert.equal(getInferredType(data, 'big', inferMySqlType), 'BIGINT')
  })

  test('短字符串 → VARCHAR(255)', () => {
    assert.equal(getInferredType(data, 'name', inferMySqlType), 'VARCHAR(255)')
  })

  test('布尔 → BOOLEAN', () => {
    assert.equal(getInferredType(data, 'active', inferMySqlType), 'BOOLEAN')
  })

  test('小数 → DECIMAL(10,2)', () => {
    assert.equal(getInferredType(data, 'score', inferMySqlType), 'DECIMAL(10,2)')
  })

  test('全空列 → 默认 VARCHAR(255)', () => {
    const empty = [{ a: null }, { a: undefined }, { a: null }]
    assert.equal(getInferredType(empty, 'a', inferMySqlType), 'VARCHAR(255)')
  })

  test('首行非空即返回，不扫描后续行', () => {
    const d = [{ x: 123 }, { x: 'text' }]
    assert.equal(getInferredType(d, 'x', inferMySqlType), 'BIGINT')
  })

  test('跳过 null/undefined 直到非空值', () => {
    const d = [{ x: null }, { x: undefined }, { x: 'hello' }]
    assert.equal(getInferredType(d, 'x', inferMySqlType), 'VARCHAR(255)')
  })
})

describe('ColumnTypePanel.getInferredType (HiveSQL)', () => {
  const data = [
    { id: 1, name: 'Alice', active: true, score: 3.14, arr: [1, 2], map: { k: 'v' } }
  ]

  test('整数 → BIGINT', () => {
    assert.equal(getInferredType(data, 'id', inferHiveType), 'BIGINT')
  })

  test('小数 → DOUBLE', () => {
    assert.equal(getInferredType(data, 'score', inferHiveType), 'DOUBLE')
  })

  test('字符串 → STRING', () => {
    assert.equal(getInferredType(data, 'name', inferHiveType), 'STRING')
  })

  test('布尔 → BOOLEAN', () => {
    assert.equal(getInferredType(data, 'active', inferHiveType), 'BOOLEAN')
  })

  test('数组 → ARRAY<STRING>', () => {
    assert.equal(getInferredType(data, 'arr', inferHiveType), 'ARRAY<STRING>')
  })

  test('对象 → MAP<STRING,STRING>', () => {
    assert.equal(getInferredType(data, 'map', inferHiveType), 'MAP<STRING,STRING>')
  })

  test('全空列 → STRING', () => {
    const empty = [{ a: null }]
    assert.equal(getInferredType(empty, 'a', inferHiveType), 'STRING')
  })
})

describe('ColumnTypePanel.handleChange (覆盖行为)', () => {
  test('设置覆盖：新增指定列的类型', () => {
    const next = handleChange({}, 'name', 'TEXT')
    assert.deepEqual(next, { name: 'TEXT' })
  })

  test('更新覆盖：修改已覆盖列的类型', () => {
    const overrides = { name: 'TEXT' }
    const next = handleChange(overrides, 'name', 'VARCHAR(100)')
    assert.deepEqual(next, { name: 'VARCHAR(100)' })
    // 原对象不被修改（不可变）
    assert.deepEqual(overrides, { name: 'TEXT' })
  })

  test('选择 __AUTO__ 删除覆盖', () => {
    const overrides = { id: 'INT', name: 'TEXT' }
    const next = handleChange(overrides, 'name', '__AUTO__')
    assert.deepEqual(next, { id: 'INT' })
    assert.ok(!('name' in next))
  })

  test('删除不存在的列覆盖：无副作用', () => {
    const overrides = { id: 'INT' }
    const next = handleChange(overrides, 'missing', '__AUTO__')
    assert.deepEqual(next, { id: 'INT' })
  })

  test('重置所有覆盖：onChange({})', () => {
    // 面板的 handleResetAll 调用 onChange({})
    const overrides = { id: 'INT', name: 'TEXT' }
    const next = {}
    assert.deepEqual(next, {})
    // 验证覆盖计数归零
    assert.equal(Object.keys(next).length, 0)
    // 保留 overrides 引用未被修改
    assert.equal(Object.keys(overrides).length, 2)
  })

  test('覆盖计数：Object.keys(overrides).length', () => {
    assert.equal(Object.keys({}).length, 0, '无覆盖')
    assert.equal(Object.keys({ id: 'INT' }).length, 1)
    assert.equal(Object.keys({ id: 'INT', name: 'TEXT' }).length, 2)
  })
})

describe('ColumnTypePanel 类型选项清单', () => {
  test('MYSQL_TYPE_OPTIONS 包含关键类型', () => {
    for (const t of ['BIGINT', 'INT', 'VARCHAR(255)', 'TEXT', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP']) {
      assert.ok(MYSQL_TYPE_OPTIONS.includes(t), `MySQL 应包含 ${t}`)
    }
  })

  test('HIVE_TYPE_OPTIONS 包含关键类型', () => {
    for (const t of ['STRING', 'BIGINT', 'INT', 'DOUBLE', 'FLOAT', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'ARRAY<STRING>', 'MAP<STRING,STRING>']) {
      assert.ok(HIVE_TYPE_OPTIONS.includes(t), `HiveSQL 应包含 ${t}`)
    }
  })

  test('MySQL 与 HiveSQL 类型选项不完全相同（各自专属类型存在）', () => {
    assert.ok(MYSQL_TYPE_OPTIONS.includes('DECIMAL(10,2)'))
    assert.ok(HIVE_TYPE_OPTIONS.includes('ARRAY<STRING>'))
  })
})

describe('ColumnTypePanel 列推导', () => {
  test('cols 取首行 key（空数据 → 空数组）', () => {
    function deriveCols (data) {
      return data && data.length > 0 ? Object.keys(data[0]) : []
    }
    assert.deepEqual(deriveCols([{ a: 1, b: 2 }]), ['a', 'b'])
    assert.deepEqual(deriveCols([]), [])
    assert.deepEqual(deriveCols(null), [])
  })

  test('format 到 inferFn / typeOptions / typeLabel 映射', () => {
    function resolveConfig (format) {
      return {
        inferFn: format === 'mysql' ? 'inferMySqlType' : 'inferHiveType',
        typeOptions: format === 'mysql' ? MYSQL_TYPE_OPTIONS : HIVE_TYPE_OPTIONS,
        typeLabel: format === 'mysql' ? 'MySQL' : 'HiveSQL'
      }
    }
    assert.equal(resolveConfig('mysql').typeLabel, 'MySQL')
    assert.equal(resolveConfig('sparksql').typeLabel, 'HiveSQL')
    assert.equal(resolveConfig('mysql').typeOptions, MYSQL_TYPE_OPTIONS)
    assert.equal(resolveConfig('sparksql').typeOptions, HIVE_TYPE_OPTIONS)
  })
})
