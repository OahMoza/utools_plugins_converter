import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToHiveSql, hiveSqlToWrapper, validateHiveSql, inferHiveType, HIVE_TYPE_OPTIONS } from '../hivesql.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('jsonToHiveSql 生成 INSERT INTO', () => {
  const sql = jsonToHiveSql(sample, { tableName: 'users' })
  assert.ok(sql.includes('INSERT INTO `users`'))
  assert.ok(sql.includes('(`name`, `age`)'))
  assert.ok(sql.includes("('Alice', 30)"))
})

test('writeMode = overwrite', () => {
  const sql = jsonToHiveSql([{ id: 1 }], { tableName: 't', writeMode: 'overwrite' })
  assert.ok(sql.includes('INSERT OVERWRITE'))
})

test('默认 batchMode 批量模式', () => {
  const sql = jsonToHiveSql(sample, { tableName: 'users' })
  assert.ok(sql.includes("('Alice', 30),\n  ('Bob', 25)"))
})

test('batchMode: false 每行独立 INSERT', () => {
  const sql = jsonToHiveSql(sample, { tableName: 'users', batchMode: false })
  const lines = sql.split('\n')
  assert.equal(lines.length, 2)
  assert.ok(lines[0].startsWith('INSERT INTO'))
})

test('指定 database', () => {
  const sql = jsonToHiveSql([{ id: 1 }], { database: 'mydb', tableName: 't' })
  assert.ok(sql.includes('`mydb`.`t`'))
})

test('nullHandling = NULL', () => {
  const sql = jsonToHiveSql([{ name: null }], { tableName: 't', nullHandling: 'NULL' })
  assert.ok(sql.includes('NULL'))
})

test('nullHandling = empty_string', () => {
  const sql = jsonToHiveSql([{ name: null }], { tableName: 't', nullHandling: 'empty_string' })
  assert.ok(sql.includes("''"))
})

test('includeCreateTable 生成建表语句', () => {
  const sql = jsonToHiveSql(sample, { tableName: 'users', includeCreateTable: true })
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS'))
  assert.ok(sql.includes("TBLPROPERTIES"))
})

test('静态分区', () => {
  const sql = jsonToHiveSql(sample, {
    tableName: 'users',
    partitionMode: 'static',
    staticPartition: 'dt=2024-01-01'
  })
  assert.ok(sql.includes('PARTITION (dt=2024-01-01)'))
})

test('动态分区', () => {
  const sql = jsonToHiveSql(
    [{ name: 'A', dt: '2024-01-01' }, { name: 'B', dt: '2024-01-01' }],
    { tableName: 't', partitionMode: 'dynamic', partitionColumns: 'dt' }
  )
  assert.ok(sql.includes("PARTITION (dt='2024-01-01')"))
})

test('空数组返回空字符串', () => {
  const sql = jsonToHiveSql([], { tableName: 't' })
  assert.equal(sql, '')
})

test('单条数据', () => {
  const sql = jsonToHiveSql([{ id: 1 }], { tableName: 't' })
  assert.ok(sql.includes('VALUES'))
  assert.ok(sql.includes('(1)'))
})

test('字符串值被转义引号', () => {
  const sql = jsonToHiveSql([{ name: "O'Brien" }], { tableName: 't' })
  assert.ok(sql.includes("O''Brien"))
})

test('inferHiveType 推断类型', () => {
  assert.equal(inferHiveType(123), 'BIGINT')
  assert.equal(inferHiveType(1.5), 'DOUBLE')
  assert.equal(inferHiveType(true), 'BOOLEAN')
  assert.equal(inferHiveType(null), 'STRING')
  assert.equal(inferHiveType('hello'), 'STRING')
  assert.equal(inferHiveType([1, 2]), 'ARRAY<STRING>')
  assert.equal(inferHiveType({ a: 1 }), 'MAP<STRING,STRING>')
})

test('HIVE_TYPE_OPTIONS 是数组', () => {
  assert.ok(Array.isArray(HIVE_TYPE_OPTIONS))
  assert.ok(HIVE_TYPE_OPTIONS.length > 0)
})

test('hiveSqlToWrapper 解析 INSERT INTO', () => {
  const sql = "INSERT INTO users (`name`, `age`) VALUES ('Alice', 30), ('Bob', 25)"
  const result = hiveSqlToWrapper(sql)
  assert.ok(result)
  assert.equal(result.tableName, 'users')
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].name, 'Alice')
})

test('hiveSqlToWrapper 解析 INSERT OVERWRITE', () => {
  const sql = "INSERT OVERWRITE `db`.`t` (`id`) VALUES (1)"
  const result = hiveSqlToWrapper(sql)
  assert.ok(result)
  assert.equal(result.tableName, 'db')
})

test('hiveSqlToWrapper 解析静态分区', () => {
  const sql = "INSERT INTO t (`name`) PARTITION (dt='2024') VALUES ('A')"
  const result = hiveSqlToWrapper(sql)
  assert.ok(result)
  assert.equal(result.partition.dt, '2024')
})

test('hiveSqlToWrapper 值内含逗号正确解析', () => {
  // parseValuesBlock 用 tokenizer 分割值，值内含逗号不再错误分割
  const sql = "INSERT INTO t (name) VALUES ('Smith, John')"
  const result = hiveSqlToWrapper(sql)
  assert.ok(result)
  assert.equal(result.rows[0].name, 'Smith, John')
})

test('hiveSqlToWrapper 非 INSERT 返回 null', () => {
  assert.equal(hiveSqlToWrapper('SELECT * FROM t'), null)
})

test('hiveSqlToWrapper 无 VALUES 返回 null', () => {
  assert.equal(hiveSqlToWrapper('INSERT INTO t (a)'), null)
})

test('validateHiveSql 合法 INSERT', () => {
  assert.equal(validateHiveSql('INSERT INTO t (a) VALUES (1)'), true)
  assert.equal(validateHiveSql('INSERT OVERWRITE t (a) VALUES (1)'), true)
})

test('validateHiveSql 含 SELECT 拒绝', () => {
  assert.equal(validateHiveSql('INSERT INTO t SELECT * FROM s'), false)
})

test('validateHiveSql 无 VALUES 拒绝', () => {
  assert.equal(validateHiveSql('INSERT INTO t (a)'), false)
})

test('validateHiveSql 非 INSERT 拒绝', () => {
  assert.equal(validateHiveSql('SELECT 1'), false)
})
