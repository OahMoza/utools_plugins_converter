import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToCsv, csvToJson, validateCsv } from '../csv.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('jsonToCsv 标准数组转 CSV', () => {
  const csv = jsonToCsv(sample)
  assert.ok(csv.includes('name,age'))
  assert.ok(csv.includes('Alice,30'))
  assert.ok(csv.includes('Bob,25'))
})

test('csvToJson 能解析回 JSON 数组', () => {
  const csv = jsonToCsv(sample)
  const result = csvToJson(csv)
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
  assert.equal(result[0].age, 30)
})

test('自定义分隔符', () => {
  const csv = jsonToCsv(sample, { delimiter: '\t' })
  assert.ok(csv.includes('name\tage'))
  const result = csvToJson(csv, { delimiter: '\t' })
  assert.equal(result[0].name, 'Alice')
})

test('关闭表头', () => {
  const csv = jsonToCsv(sample, { header: false })
  assert.ok(!csv.includes('name,age'))
  assert.ok(csv.includes('Alice,30'))
})

test('单条数据', () => {
  const csv = jsonToCsv([{ x: 1 }])
  const result = csvToJson(csv)
  assert.equal(result.length, 1)
  assert.equal(result[0].x, 1)
})

test('空数组产生空字符串', () => {
  const csv = jsonToCsv([])
  assert.equal(csv.trim(), '')
})

test('值内含逗号被正确引用', () => {
  const data = [{ name: 'Smith, John', age: 40 }]
  const csv = jsonToCsv(data)
  // papaparse 会引用含逗号的字段
  assert.ok(csv.includes('"Smith, John"'))
  const result = csvToJson(csv)
  assert.equal(result[0].name, 'Smith, John')
})

test('值内含换行被正确引用', () => {
  const data = [{ text: 'line1\nline2' }]
  const csv = jsonToCsv(data)
  const result = csvToJson(csv)
  assert.equal(result[0].text, 'line1\nline2')
})

test('null 值输出为字符串 null', () => {
  const data = [{ name: null }]
  const csv = jsonToCsv(data)
  assert.ok(csv.includes('null'))
  const result = csvToJson(csv)
  assert.equal(result[0].name, null)
})

test('对象值被 JSON.stringify 并转义引号', () => {
  const data = [{ meta: { a: 1 } }]
  const csv = jsonToCsv(data)
  // 内部双引号被 CSV 转义为 ""
  assert.ok(csv.includes('{"a":1}') || csv.includes('"{""a"":1}"'))
})

test('HTML 表格输入自动识别', () => {
  const html = '<table><tr><th>name</th><th>age</th></tr><tr><td>Alice</td><td>30</td></tr></table>'
  const result = csvToJson(html)
  // 表头行成为键，1 个数据行 → 1 行
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Alice')
  assert.equal(result[0].age, 30)
})

test('validateCsv 合法 CSV', () => {
  assert.equal(validateCsv('a,b\n1,2'), true)
})

test('validateCsv 合法 HTML 表格', () => {
  assert.equal(validateCsv('<table><tr><td>a</td></tr></table>'), true)
})

test('validateCsv 非法输入', () => {
  assert.equal(validateCsv(''), false)
})
