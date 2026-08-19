import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToXlsx, xlsxToJson } from '../xlsx.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('jsonToXlsx 返回 ArrayBuffer', () => {
  const buf = jsonToXlsx(sample)
  assert.ok(buf instanceof ArrayBuffer)
  assert.ok(buf.byteLength > 0)
})

test('自定义 sheetName', () => {
  const buf = jsonToXlsx(sample, { sheetName: 'Users' })
  assert.ok(buf instanceof ArrayBuffer)
  const result = xlsxToJson(buf)
  assert.equal(result.length, 2)
})

test('xlsxToJson 能解析回 JSON 数组', () => {
  const buf = jsonToXlsx(sample)
  const result = xlsxToJson(buf)
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
  assert.equal(result[0].age, 30)
})

test('单条数据', () => {
  const buf = jsonToXlsx([{ x: 1 }])
  const result = xlsxToJson(buf)
  assert.equal(result.length, 1)
  assert.equal(result[0].x, 1)
})

test('ArrayBuffer 是有效的 xlsx（PK 魔数）', () => {
  const buf = jsonToXlsx(sample)
  const view = new Uint8Array(buf)
  // xlsx 是 zip 格式，以 PK (0x50 0x4B) 开头
  assert.equal(view[0], 0x50)
  assert.equal(view[1], 0x4B)
})

test('特殊字符：Unicode 和特殊符号', () => {
  const data = [{ text: '中文 😀', symbol: '<>&' }]
  const buf = jsonToXlsx(data)
  const result = xlsxToJson(buf)
  assert.equal(result[0].text, '中文 😀')
  assert.equal(result[0].symbol, '<>&')
})

test('空对象数组导出后解析为空（xlsx 库跳过无键行）', () => {
  const buf = jsonToXlsx([{}])
  const result = xlsxToJson(buf)
  assert.equal(result.length, 0)
})
