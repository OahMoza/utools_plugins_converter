import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseInput, stringifyOutput, validateInput, autoDetectFormat } from '../index.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('parseInput JSON', () => {
  const result = parseInput('[{"name":"Alice"}]', 'json')
  assert.deepEqual(result, [{ name: 'Alice' }])
})

test('stringifyOutput JSON', () => {
  const result = stringifyOutput(sample, 'json')
  assert.equal(typeof result, 'string')
  assert.ok(result.includes('"name": "Alice"'))
})

test('parseInput YAML', () => {
  const yaml = '- name: Alice\n  age: 30\n- name: Bob\n  age: 25\n'
  const result = parseInput(yaml, 'yaml')
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
})

test('stringifyOutput YAML', () => {
  const result = stringifyOutput(sample, 'yaml')
  assert.ok(result.includes('name: Alice'))
})

test('parseInput TOML', () => {
  const toml = '[[data]]\nname = "Alice"\nage = 30\n'
  const result = parseInput(toml, 'toml')
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Alice')
})

test('stringifyOutput TOML', () => {
  const result = stringifyOutput([{ x: 1 }], 'toml')
  assert.ok(result.includes('[[data]]'))
})

test('parseInput XML', () => {
  const xml = '<root><item><name>Alice</name></item></root>'
  const result = parseInput(xml, 'xml')
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Alice')
})

test('stringifyOutput XML', () => {
  const result = stringifyOutput([{ x: 1 }], 'xml')
  assert.ok(result.includes('<root>'))
})

test('parseInput CSV', () => {
  const csv = 'name,age\nAlice,30\nBob,25\n'
  const result = parseInput(csv, 'csv')
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
})

test('stringifyOutput CSV', () => {
  const result = stringifyOutput(sample, 'csv')
  assert.ok(result.includes('name,age'))
})

test('parseInput Markdown 单列', () => {
  const md = '| name |\n| --- |\n| Alice |\n| Bob |\n'
  const result = parseInput(md, 'markdown')
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
})

test('stringifyOutput Markdown', () => {
  const result = stringifyOutput(sample, 'markdown')
  assert.ok(result.includes('| name | age |'))
})

test('parseInput MySQL', () => {
  const sql = "INSERT INTO users (`name`, `age`) VALUES ('Alice', 30)"
  const result = parseInput(sql, 'mysql')
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Alice')
})

test('stringifyOutput MySQL', () => {
  const r = stringifyOutput(sample, 'mysql', { tableName: 'users' })
  assert.ok(r.includes('INSERT INTO'))
})

test('parseInput sparksql', () => {
  const sql = "INSERT OVERWRITE TABLE t PARTITION (dt='2024') (`name`) VALUES ('A')"
  const result = parseInput(sql, 'sparksql')
  assert.ok(result)
})

test('stringifyOutput sparksql', () => {
  const r = stringifyOutput(sample, 'sparksql', { tableName: 'users' })
  assert.ok(r.includes('INSERT'))
})

test('parseInput 未知格式返回空数组', () => {
  assert.deepEqual(parseInput('x', 'unknown'), [])
})

test('stringifyOutput 未知格式返回空字符串', () => {
  assert.equal(stringifyOutput(sample, 'unknown'), '')
})

test('validateInput JSON 合法', () => {
  assert.equal(validateInput('{"a":1}', 'json'), true)
})

test('validateInput JSON 非法', () => {
  assert.equal(validateInput('{invalid', 'json'), false)
})

test('validateInput YAML 合法', () => {
  assert.equal(validateInput('foo: bar', 'yaml'), true)
})

test('validateInput TOML 合法', () => {
  assert.equal(validateInput('foo = "bar"', 'toml'), true)
})

test('validateInput XML 合法', () => {
  assert.equal(validateInput('<r/>', 'xml'), true)
})

test('validateInput CSV 合法', () => {
  assert.equal(validateInput('a,b\n1,2', 'csv'), true)
})

test('validateInput Markdown 合法', () => {
  assert.equal(validateInput('| a |\n| --- |\n| 1 |', 'markdown'), true)
})

test('validateInput sparksql 合法', () => {
  assert.equal(validateInput('INSERT INTO t (a) VALUES (1)', 'sparksql'), true)
})

test('validateInput 未知格式返回 false', () => {
  assert.equal(validateInput('x', 'unknown'), false)
})

// —— autoDetectFormat 启发式规则 ——

test('autoDetectFormat 空输入默认 json', () => {
  assert.equal(autoDetectFormat(''), 'json')
  assert.equal(autoDetectFormat('   '), 'json')
})

test('autoDetectFormat 识别 JSON', () => {
  assert.equal(autoDetectFormat('[{"a":1}]'), 'json')
  assert.equal(autoDetectFormat('{"a":1}'), 'json')
})

test('autoDetectFormat 识别 XML', () => {
  assert.equal(autoDetectFormat('<root/>'), 'xml')
  assert.equal(autoDetectFormat('<?xml version="1.0"?><r/>'), 'xml')
})

test('autoDetectFormat HTML 表格以 < 开头识别为 xml', () => {
  // 启发式优先匹配 < 前缀 → xml（在 csv 的 <table> 检查之前）
  assert.equal(autoDetectFormat('<table><tr><td>a</td></tr></table>'), 'xml')
})

test('autoDetectFormat 识别 YAML', () => {
  // 含 ": " 和换行，无逗号
  assert.equal(autoDetectFormat('foo: bar\nbaz: 1'), 'yaml')
})

test('autoDetectFormat 识别 TOML', () => {
  assert.equal(autoDetectFormat('foo = "bar"\n[[data]]\nx = 1'), 'toml')
})

test('autoDetectFormat 识别 Markdown 表格', () => {
  assert.equal(autoDetectFormat('| a | b |\n| --- | --- |\n| 1 | 2 |'), 'markdown')
})

test('autoDetectFormat 识别 sparksql', () => {
  const sql = "INSERT OVERWRITE TABLE t PARTITION (dt='2024') VALUES ('A')"
  assert.equal(autoDetectFormat(sql), 'sparksql')
})

test('autoDetectFormat 识别全引号行为 csv', () => {
  const csv = '"a","b"\n"1","2"'
  assert.equal(autoDetectFormat(csv), 'csv')
})

test('autoDetectFormat 识别 Tab 分隔为 csv', () => {
  const tsv = 'a\tb\tc\n1\t2\t3'
  assert.equal(autoDetectFormat(tsv), 'csv')
})
