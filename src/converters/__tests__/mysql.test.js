import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToMysql, mysqlToJson, inferMySqlType, MYSQL_TYPE_OPTIONS } from '../mysql.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('jsonToMysql 生成单行 INSERT', () => {
  const sql = jsonToMysql(sample, { tableName: 'users' })
  assert.ok(sql.includes('INSERT INTO `users`'))
  assert.ok(sql.includes('(`name`, `age`)'))
  assert.ok(sql.includes("VALUES ('Alice', 30)"))
})

test('mysqlToJson 能解析回 JSON（单条）', () => {
  const sql = jsonToMysql([{ name: 'Alice', age: 30 }], { tableName: 'users' })
  const result = mysqlToJson(sql)
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Alice')
  assert.equal(result[0].age, 30)
})

test('mysqlToJson batch 模式能解析多条', () => {
  const sql = jsonToMysql(sample, { tableName: 'users', batchMode: true })
  const result = mysqlToJson(sql)
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
  assert.equal(result[1].name, 'Bob')
})

test('mysqlToJson 值内含逗号正确解析（tokenizer 修复）', () => {
  const sql = jsonToMysql([{ name: 'Smith, John' }], { tableName: 't' })
  const result = mysqlToJson(sql)
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Smith, John')
})

test('mysqlToJson 值内含括号正确解析', () => {
  const sql = "INSERT INTO t (name) VALUES ('a(b)c')"
  const result = mysqlToJson(sql)
  assert.equal(result[0].name, 'a(b)c')
})

test('指定 database', () => {
  const sql = jsonToMysql([{ id: 1 }], { database: 'mydb', tableName: 't' })
  assert.ok(sql.includes('`mydb`.`t`'))
})

test('batchMode 批量模式', () => {
  const sql = jsonToMysql(sample, { tableName: 'users', batchMode: true })
  assert.ok(sql.includes("('Alice', 30),\n  ('Bob', 25)"))
})

test('nullHandling = NULL', () => {
  const sql = jsonToMysql([{ name: null }], { tableName: 't', nullHandling: 'NULL' })
  assert.ok(sql.includes('NULL'))
})

test('nullHandling = empty_string', () => {
  const sql = jsonToMysql([{ name: null }], { tableName: 't', nullHandling: 'empty_string' })
  assert.ok(sql.includes("''"))
})

test('nullHandling = skip_column 跳过列', () => {
  const sql = jsonToMysql(
    [{ name: 'A', age: null }],
    { tableName: 't', nullHandling: 'skip_column' }
  )
  assert.ok(!sql.includes('age'))
  assert.ok(sql.includes('`name`'))
})

test('includeCreateTable 生成建表语句', () => {
  const sql = jsonToMysql(sample, { tableName: 'users', includeCreateTable: true })
  assert.ok(sql.includes('CREATE TABLE'))
  assert.ok(sql.includes('`name` VARCHAR(255)'))
  assert.ok(sql.includes('`age` BIGINT'))
})

test('columnTypeOverrides 覆盖列类型', () => {
  const sql = jsonToMysql(
    [{ name: 'A', age: 1 }],
    { tableName: 't', includeCreateTable: true, columnTypeOverrides: { name: 'TEXT', age: 'INT' } }
  )
  assert.ok(sql.includes('`name` TEXT'))
  assert.ok(sql.includes('`age` INT'))
})

test('空数组返回空字符串', () => {
  const sql = jsonToMysql([], { tableName: 't' })
  assert.equal(sql, '')
})

test('单条数据', () => {
  const sql = jsonToMysql([{ id: 1 }], { tableName: 't' })
  assert.ok(sql.includes('VALUES (1)'))
})

test('字符串值被转义引号', () => {
  const sql = jsonToMysql([{ name: "O'Brien" }], { tableName: 't' })
  assert.ok(sql.includes("O''Brien"))
})

test('inferMySqlType 推断类型', () => {
  assert.equal(inferMySqlType(123), 'BIGINT')
  assert.equal(inferMySqlType(1.5), 'DECIMAL(10,2)')
  assert.equal(inferMySqlType(true), 'BOOLEAN')
  assert.equal(inferMySqlType(null), 'VARCHAR(255)')
  assert.equal(inferMySqlType('short'), 'VARCHAR(255)')
  assert.equal(inferMySqlType('x'.repeat(300)), 'TEXT')
})

test('MYSQL_TYPE_OPTIONS 是数组', () => {
  assert.ok(Array.isArray(MYSQL_TYPE_OPTIONS))
  assert.ok(MYSQL_TYPE_OPTIONS.length > 0)
})

test('mysqlToJson 非 INSERT 返回空数组', () => {
  assert.deepEqual(mysqlToJson('SELECT * FROM t'), [])
})

test('mysqlToJson 无 VALUES 返回空数组', () => {
  assert.deepEqual(mysqlToJson('INSERT INTO t (a)'), [])
})

test('mysqlToJson 处理 TRUE/FALSE', () => {
  const sql = 'INSERT INTO t (flag) VALUES (TRUE)'
  const result = mysqlToJson(sql)
  assert.equal(result[0].flag, true)
})

test('mysqlToJson 处理 NULL', () => {
  const sql = 'INSERT INTO t (name) VALUES (NULL)'
  const result = mysqlToJson(sql)
  assert.equal(result[0].name, null)
})

test('mysqlToJson 处理数字', () => {
  const sql = 'INSERT INTO t (n) VALUES (42)'
  const result = mysqlToJson(sql)
  assert.equal(result[0].n, 42)
})

test('mysqlToJson 处理带引号字符串', () => {
  const sql = "INSERT INTO t (name) VALUES ('Alice')"
  const result = mysqlToJson(sql)
  assert.equal(result[0].name, 'Alice')
})

test('mysqlToJson 处理引号转义', () => {
  const sql = "INSERT INTO t (name) VALUES ('O''Brien')"
  const result = mysqlToJson(sql)
  assert.equal(result[0].name, "O'Brien")
})
