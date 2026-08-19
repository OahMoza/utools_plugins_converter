// useEditableTable.test.js — TDD for useEditableTable Hook
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { editableTableReducer, createInitialState } from '../../src/hooks/useEditableTable.js'

const sampleData = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 }
]
const sampleColumns = ['id', 'name', 'age']

test('createInitialState returns clean state', () => {
  const state = createInitialState(sampleData, sampleColumns)
  assert.deepEqual(state.displayData, sampleData)
  assert.deepEqual(state.columns, sampleColumns)
  assert.equal(state.isDirty, false)
  assert.equal(state.editingCell, null)
  assert.equal(state.editValue, '')
})

test('START_EDIT sets editing cell and editValue', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const state = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
  assert.deepEqual(state.editingCell, { row: 0, col: 'name' })
  assert.equal(state.editValue, 'Alice')
})

test('SET_EDIT_VALUE updates editValue', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const editing = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
  const state = editableTableReducer(editing, { type: 'SET_EDIT_VALUE', value: 'Alex' })
  assert.equal(state.editValue, 'Alex')
})

test('COMMIT_EDIT updates displayData and isDirty', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const editing = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
  const withValue = editableTableReducer(editing, { type: 'SET_EDIT_VALUE', value: 'Alex' })
  const state = editableTableReducer(withValue, { type: 'COMMIT_EDIT' })
  assert.equal(state.displayData[0].name, 'Alex')
  assert.equal(state.isDirty, true)
  assert.equal(state.editingCell, null)
  assert.equal(state.editValue, '')
})

test('CANCEL_EDIT reverts editValue and clears editing', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const editing = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
  const state = editableTableReducer(editing, { type: 'CANCEL_EDIT' })
  assert.equal(state.editingCell, null)
  assert.equal(state.editValue, '')
  assert.equal(state.displayData[0].name, 'Alice') // unchanged
  assert.equal(state.isDirty, false)
})

test('RENAME_COLUMN updates column name in all rows', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const state = editableTableReducer(initial, { type: 'RENAME_COLUMN', oldName: 'name', newName: 'fullName' })
  assert.ok('fullName' in state.displayData[0])
  assert.ok(!('name' in state.displayData[0]))
  assert.equal(state.displayData[0].fullName, 'Alice')
  assert.ok(state.columns.includes('fullName'))
  assert.ok(!state.columns.includes('name'))
  assert.equal(state.isDirty, true)
})

test('RENAME_COLUMN rejects duplicate name', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const state = editableTableReducer(initial, { type: 'RENAME_COLUMN', oldName: 'name', newName: 'age' })
  assert.deepEqual(state.columns, sampleColumns) // unchanged
})

test('ADD_ROW appends default row', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const state = editableTableReducer(initial, { type: 'ADD_ROW' })
  assert.equal(state.displayData.length, 3)
  assert.equal(state.displayData[2].name, '')
  assert.equal(state.displayData[2].age, 0)
  assert.equal(state.isDirty, true)
})

test('REMOVE_ROW deletes row at index', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  const state = editableTableReducer(initial, { type: 'REMOVE_ROW', index: 0 })
  assert.equal(state.displayData.length, 1)
  assert.equal(state.displayData[0].name, 'Bob')
  assert.equal(state.isDirty, true)
})

test('RESET restores original data and clears dirty', () => {
  const initial = createInitialState(sampleData, sampleColumns)
  let state = editableTableReducer(initial, { type: 'ADD_ROW' })
  state = editableTableReducer(state, { type: 'RESET', data: sampleData, columns: sampleColumns })
  assert.deepEqual(state.displayData, sampleData)
  assert.equal(state.isDirty, false)
  assert.equal(state.editingCell, null)
})

test('editing null/undefined value shows empty string', () => {
  const data = [{ id: 1, name: null }, { id: 2, name: undefined }]
  const initial = createInitialState(data, ['id', 'name'])
  const state0 = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
  assert.equal(state0.editValue, '')
  const state1 = editableTableReducer(initial, { type: 'START_EDIT', row: 1, col: 'name' })
  assert.equal(state1.editValue, '')
})

test('editing object value shows JSON text', () => {
  const data = [{ id: 1, meta: { a: 1 } }]
  const initial = createInitialState(data, ['id', 'meta'])
  const state = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'meta' })
  assert.equal(state.editValue, JSON.stringify({ a: 1 }, null, 2))
})

// ── 补充测试 ─────────────────────────────────────────────────────

test('连续编辑多个单元格：两次提交均生效且 isDirty 保持 true', () => {
  let state = createInitialState(sampleData, sampleColumns)

  // 第一次编辑：(0, name) Alice → Alex
  state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
  state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Alex' })
  state = editableTableReducer(state, { type: 'COMMIT_EDIT' })
  assert.equal(state.displayData[0].name, 'Alex')
  assert.equal(state.isDirty, true)

  // 第二次编辑：(1, age) 25 → 40
  state = editableTableReducer(state, { type: 'START_EDIT', row: 1, col: 'age' })
  state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: '40' })
  state = editableTableReducer(state, { type: 'COMMIT_EDIT' })
  assert.equal(state.displayData[1].age, 40)
  assert.equal(state.isDirty, true)

  // 两次修改同时保留
  assert.equal(state.displayData[0].name, 'Alex')
})

test('编辑后 reset 再编辑：reset 清除脏标记，后续编辑重新生效', () => {
  let state = createInitialState(sampleData, sampleColumns)

  // 编辑并提交
  state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
  state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Alex' })
  state = editableTableReducer(state, { type: 'COMMIT_EDIT' })
  assert.equal(state.isDirty, true)
  assert.equal(state.displayData[0].name, 'Alex')

  // reset 回到原始数据
  state = editableTableReducer(state, { type: 'RESET', data: sampleData, columns: sampleColumns })
  assert.equal(state.isDirty, false)
  assert.equal(state.displayData[0].name, 'Alice')

  // 再次编辑：(0, name) Alice → Amy
  state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
  state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Amy' })
  state = editableTableReducer(state, { type: 'COMMIT_EDIT' })
  assert.equal(state.displayData[0].name, 'Amy')
  assert.equal(state.isDirty, true)
})

test('空数据集行为：初始干净、可添加行、越界删除安全', () => {
  const initial = createInitialState([], [])
  assert.deepEqual(initial.displayData, [])
  assert.deepEqual(initial.columns, [])
  assert.equal(initial.isDirty, false)

  // 空集添加行：无样本时所有字段默认空字符串
  const added = editableTableReducer(initial, { type: 'ADD_ROW' })
  assert.equal(added.displayData.length, 1)
  assert.equal(added.isDirty, true)

  // 越界删除不抛错、数据不变
  const removed = editableTableReducer(initial, { type: 'REMOVE_ROW', index: 0 })
  assert.deepEqual(removed.displayData, [])
  const negRemoved = editableTableReducer(initial, { type: 'REMOVE_ROW', index: -1 })
  assert.deepEqual(negRemoved.displayData, [])

  // reset 空数据仍回到干净空状态
  const reset = editableTableReducer(added, { type: 'RESET', data: [], columns: [] })
  assert.deepEqual(reset.displayData, [])
  assert.equal(reset.isDirty, false)
})

test('createInitialState: 防御非数组 columns 参数', () => {
  // columns 为 undefined/null/非数组时应返回空数组，不抛错
  const s1 = createInitialState([], undefined)
  assert.deepEqual(s1.columns, [])
  const s2 = createInitialState([], null)
  assert.deepEqual(s2.columns, [])
  const s3 = createInitialState([], 'invalid')
  assert.deepEqual(s3.columns, [])
  const s4 = createInitialState(null, undefined)
  assert.deepEqual(s4.displayData, [])
  assert.deepEqual(s4.columns, [])
})
