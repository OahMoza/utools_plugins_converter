import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToToml, tomlToJson, validateToml } from '../toml.js'

const sample = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]

test('jsonToToml 标准数组转 TOML', () => {
  const toml = jsonToToml(sample)
  assert.ok(toml.includes('[[data]]'))
  assert.ok(toml.includes('name = "Alice"'))
  assert.ok(toml.includes('age = 30'))
})

test('tomlToJson 能解析回 JSON 数组', () => {
  const toml = jsonToToml(sample)
  const result = tomlToJson(toml)
  assert.deepEqual(result, sample)
})

test('默认 wrapper 为 data', () => {
  const toml = jsonToToml([{ x: 1 }])
  assert.ok(toml.includes('[data]'))
})

test('自定义 wrapper 选项', () => {
  const toml = jsonToToml([{ x: 1 }], { wrapper: 'users' })
  assert.ok(toml.includes('[users]'))
  assert.ok(!toml.includes('[data]'))
})

test('tomlToJson 用匹配的 wrapper 解析', () => {
  const toml = jsonToToml([{ x: 1 }], { wrapper: 'users' })
  const result = tomlToJson(toml, { wrapper: 'users' })
  assert.deepEqual(result, [{ x: 1 }])
})

test('空数组', () => {
  const toml = jsonToToml([])
  const result = tomlToJson(toml)
  assert.deepEqual(result, [])
})

test('特殊字符：引号、反斜杠', () => {
  const realData = [{ text: 'he said "hi"', path: 'C:\\temp' }]
  const toml = jsonToToml(realData)
  const result = tomlToJson(toml)
  assert.equal(result[0].text, 'he said "hi"')
  assert.equal(result[0].path, 'C:\\temp')
})

test('validateToml 合法 TOML', () => {
  assert.equal(validateToml('foo = "bar"'), true)
  assert.equal(validateToml('[[data]]\nfoo = 1'), true)
})

test('validateToml 非法输入', () => {
  // 空字符串被 smol-toml 解析为 {}，视作合法
  assert.equal(validateToml('a ='), false)
  assert.equal(validateToml('x = "unclosed'), false)
})
