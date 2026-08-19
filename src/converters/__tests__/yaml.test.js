import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonToYaml, yamlToJson, validateYaml } from '../yaml.js'

const sample = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false }
]

test('jsonToYaml 标准数组转 YAML', () => {
  const yaml = jsonToYaml(sample)
  assert.ok(yaml.includes('name: Alice'))
  assert.ok(yaml.includes('age: 30'))
})

test('yamlToJson 能解析回 JSON 数组', () => {
  const yaml = jsonToYaml(sample)
  const result = yamlToJson(yaml)
  assert.deepEqual(result, sample)
})

test('jsonToYaml 自定义 indent 影响嵌套缩进', () => {
  // indent 选项影响嵌套映射的缩进（顶层数组项的 "- " 前缀不受影响）
  const yaml = jsonToYaml({ user: { name: 'Alice' } }, { indent: 4 })
  assert.ok(yaml.includes('    name: Alice'))
})

test('空数组转 YAML 可解析回空数组', () => {
  const yaml = jsonToYaml([])
  const result = yamlToJson(yaml)
  assert.deepEqual(result, [])
})

test('特殊字符：引号、冒号、Unicode', () => {
  const data = [{ text: 'he said: "hi"', emoji: '😀', chinese: '中文' }]
  const yaml = jsonToYaml(data)
  const result = yamlToJson(yaml)
  assert.deepEqual(result, data)
})

test('嵌套对象', () => {
  const data = [{ user: { name: 'A', tags: ['x', 'y'] } }]
  const yaml = jsonToYaml(data)
  const result = yamlToJson(yaml)
  assert.deepEqual(result, data)
})

test('validateYaml 合法 YAML', () => {
  assert.equal(validateYaml('foo: bar'), true)
  assert.equal(validateYaml('- a\n- b'), true)
})

test('validateYaml 非法输入', () => {
  // 空字符串被 yaml 解析为 null，validateYaml 视作合法（null !== undefined）
  assert.equal(validateYaml('{{{{'), false)
  assert.equal(validateYaml('\t:'), false)
})
