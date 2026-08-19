import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToXml, xmlToJson, validateXml } from '../xml.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('jsonToXml 标准数组转 XML', () => {
  const xml = jsonToXml(sample)
  assert.ok(xml.includes('<root>'))
  assert.ok(xml.includes('<item>'))
  assert.ok(xml.includes('<name>Alice</name>'))
})

test('xmlToJson 能解析回 JSON 数组', () => {
  const xml = jsonToXml(sample)
  const result = xmlToJson(xml)
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
  assert.equal(result[0].age, 30)
})

test('自定义 rootName 和 itemName', () => {
  const xml = jsonToXml(sample, { rootName: 'users', itemName: 'user' })
  assert.ok(xml.includes('<users>'))
  assert.ok(xml.includes('<user>'))
  assert.ok(!xml.includes('<root>'))
  assert.ok(!xml.includes('<item>'))
})

test('xmlToJson 用自定义名称解析', () => {
  const xml = jsonToXml(sample, { rootName: 'users', itemName: 'user' })
  const result = xmlToJson(xml, { rootName: 'users', itemName: 'user' })
  assert.equal(result.length, 2)
  assert.equal(result[0].name, 'Alice')
})

test('单条数据不生成数组结构', () => {
  const single = [{ name: 'Solo' }]
  const xml = jsonToXml(single)
  const result = xmlToJson(xml)
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Solo')
})

test('空数组', () => {
  const xml = jsonToXml([])
  assert.ok(xml.includes('<root>'))
})

test('特殊字符：< > & 被转义', () => {
  const data = [{ text: 'a < b & c > d' }]
  const xml = jsonToXml(data)
  assert.ok(xml.includes('&lt;'))
  assert.ok(xml.includes('&amp;'))
  assert.ok(xml.includes('&gt;'))
  const result = xmlToJson(xml)
  assert.equal(result[0].text, 'a < b & c > d')
})

test('validateXml 合法 XML', () => {
  assert.equal(validateXml('<root><item>1</item></root>'), true)
})

test('validateXml 非法输入', () => {
  // fast-xml-parser 对纯文本和空字符串都视作可解析
  assert.equal(validateXml('<unclosed'), false)
})
