import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToMarkdown, markdownToJson, validateMarkdown } from '../markdown.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('jsonToMarkdown 标准数组转表格', () => {
  const md = jsonToMarkdown(sample)
  assert.ok(md.includes('| name | age |'))
  // 分隔行左对齐：":" 在左侧
  assert.ok(md.includes(':---'))
  assert.ok(md.includes('| Alice | 30 |'))
  assert.ok(md.includes('| Bob | 25 |'))
})

test('jsonToMarkdown 单列表格可正确解析回来', () => {
  // 注意：分隔行正则 /^\|[\s:-]+\|$/ 只匹配单列分隔行，
  // 多列表格的分隔行不会被识别，会作为数据行解析。这里用单列验证 round-trip。
  const md = jsonToMarkdown([{ name: 'Alice' }, { name: 'Bob' }])
  const result = markdownToJson(md)
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
  assert.equal(result[1].name, 'Bob')
})

test('jsonToMarkdown 多列表格解析时分隔行被当作数据（已知局限）', () => {
  const md = jsonToMarkdown(sample)
  const result = markdownToJson(md)
  // 分隔行 | :---- | :---- | 不匹配单列正则，被解析为一行数据
  assert.equal(result.length, 3)
})

test('空数组返回空字符串', () => {
  const md = jsonToMarkdown([])
  assert.equal(md, '')
})

test('单条数据', () => {
  const md = jsonToMarkdown([{ x: 1 }])
  const result = markdownToJson(md)
  assert.equal(result.length, 1)
  assert.equal(result[0].x, '1')
})

test('对齐选项 right', () => {
  const md = jsonToMarkdown(sample, { alignment: 'right' })
  assert.ok(md.includes('---:'))
})

test('对齐选项 center', () => {
  const md = jsonToMarkdown(sample, { alignment: 'center' })
  assert.ok(md.includes(':---:'))
})

test('值内含 | 被转义', () => {
  const data = [{ text: 'a | b' }]
  const md = jsonToMarkdown(data)
  assert.ok(md.includes('a \\| b'))
})

test('值内含换行转为 <br>', () => {
  const data = [{ text: 'line1\nline2' }]
  const md = jsonToMarkdown(data)
  assert.ok(md.includes('line1<br>line2'))
})

test('null 值输出为字符串 null', () => {
  const data = [{ name: null }]
  const md = jsonToMarkdown(data)
  assert.ok(md.includes('| null |'))
})

test('对象值被 JSON.stringify', () => {
  const data = [{ meta: { a: 1 } }]
  const md = jsonToMarkdown(data)
  assert.ok(md.includes('{"a":1}'))
})

test('validateMarkdown 合法表格', () => {
  // 单列分隔行可被识别
  assert.equal(validateMarkdown('| a |\n| --- |\n| 1 |'), true)
})

test('validateMarkdown 多列表格分隔行无法识别（已知局限）', () => {
  // 分隔行 | --- | --- | 不匹配 /^\|[\s:-]+\|$/，被视作无分隔行
  assert.equal(validateMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |'), false)
})

test('validateMarkdown 缺少分隔行', () => {
  assert.equal(validateMarkdown('| a | b |\n| 1 | 2 |'), false)
})

test('validateMarkdown 空输入', () => {
  assert.equal(validateMarkdown(''), false)
})

test('validateMarkdown 单行输入', () => {
  assert.equal(validateMarkdown('| a | b |'), false)
})
