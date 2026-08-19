// PreviewPanel.test.js —— PreviewPanel 外部行为测试
//
// 项目没有 JSDOM / @testing-library/react，无法真正渲染 React 组件。
// 这里测试 PreviewPanel 的「消费逻辑契约」：给定 props，验证回调行为与
// 渲染判定条件。组件内部的 useEffect / 事件处理逻辑以等价的纯函数镜像
// 到本文件中（已标注「mirror of PreviewPanel」），断言其外部可观察行为。
//
// 真正依赖 DOM 渲染的断言（如「已编辑提示条出现在 DOM 中」）标记为 skip，
// 并说明需要 DOM 环境。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  editableTableReducer,
  createInitialState
} from '../../hooks/useEditableTable.js'

const sampleData = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 }
]
const sampleColumns = ['id', 'name', 'age']

// ── Mirror of PreviewPanel 的列推导逻辑 ──────────────────────────
// PreviewPanel 第 22 行：useEditableTable(data || [], Object.keys(data?.[0] || {}))
function deriveColumns(data) {
  return Object.keys(data?.[0] || {})
}

// ── Mirror of PreviewPanel 的 onDataChange 效应 ──────────────────
// PreviewPanel 第 34-38 行：
//   useEffect(() => { if (onDataChange && isDirty) onDataChange(displayData) },
//                 [displayData, isDirty, onDataChange])
// 该效应在 displayData 或 isDirty 变化后运行；这里用「状态迁移后是否
// 满足触发条件 + 回调是否携带正确 displayData」来等价验证。
function simulateDataChangeEffect(prevState, nextState, onDataChange) {
  const shouldCall = !!nextState.isDirty && typeof onDataChange === 'function'
  if (shouldCall) onDataChange(nextState.displayData)
  return shouldCall
}

// ── Mirror of PreviewPanel 的 hasData / empty-state 判定 ────────
// PreviewPanel 第 105 行：const hasData = displayData && displayData.length > 0
function hasData(displayData) {
  return !!(displayData && displayData.length > 0)
}

describe('PreviewPanel 消费逻辑', () => {
  test('deriveColumns: 从首行推导列（空数据返回空数组）', () => {
    assert.deepEqual(deriveColumns(sampleData), ['id', 'name', 'age'])
    assert.deepEqual(deriveColumns([]), [])
    assert.deepEqual(deriveColumns(null), [])
    assert.deepEqual(deriveColumns(undefined), [])
  })

  test('onDataChange: 编辑提交后回调收到正确的 displayData', () => {
    const initial = createInitialState(sampleData, sampleColumns)
    // 模拟一次完整编辑：START_EDIT → SET_EDIT_VALUE → COMMIT_EDIT
    const editing = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
    const withValue = editableTableReducer(editing, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    const committed = editableTableReducer(withValue, { type: 'COMMIT_EDIT' })

    let received = null
    const called = simulateDataChangeEffect(initial, committed, (data) => { received = data })

    assert.equal(called, true, 'isDirty 为 true 时应触发 onDataChange')
    assert.equal(received[0].name, 'Alex', '回调应携带编辑后的 displayData')
    assert.equal(received.length, 2, '行数应保持不变')
  })

  test('onDataChange: 未编辑（isDirty=false）时不会触发回调', () => {
    const initial = createInitialState(sampleData, sampleColumns)
    // CANCEL_EDIT 后 isDirty 仍为 false
    const editing = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
    const cancelled = editableTableReducer(editing, { type: 'CANCEL_EDIT' })

    let callCount = 0
    const called = simulateDataChangeEffect(initial, cancelled, () => { callCount++ })

    assert.equal(called, false, 'isDirty 为 false 时不应触发 onDataChange')
    assert.equal(callCount, 0)
  })

  test('onDataChange: 未传入 onDataChange prop 时效应静默', () => {
    const initial = createInitialState(sampleData, sampleColumns)
    const editing = editableTableReducer(initial, { type: 'START_EDIT', row: 1, col: 'age' })
    const withValue = editableTableReducer(editing, { type: 'SET_EDIT_VALUE', value: '99' })
    const committed = editableTableReducer(withValue, { type: 'COMMIT_EDIT' })

    // onDataChange 为 undefined
    const called = simulateDataChangeEffect(initial, committed, undefined)
    assert.equal(called, false, '无 onDataChange 时不应触发')
  })

  test('onDataChange: 连续编辑多个单元格，每次提交都触发回调', () => {
    let state = createInitialState(sampleData, sampleColumns)
    const received = []

    // 编辑单元格 (0, name)
    state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
    state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    const s1 = editableTableReducer(state, { type: 'COMMIT_EDIT' })
    simulateDataChangeEffect(state, s1, (d) => received.push(d))
    state = s1

    // 编辑单元格 (1, age)
    state = editableTableReducer(state, { type: 'START_EDIT', row: 1, col: 'age' })
    state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: '40' })
    const s2 = editableTableReducer(state, { type: 'COMMIT_EDIT' })
    simulateDataChangeEffect(state, s2, (d) => received.push(d))

    assert.equal(received.length, 2, '两次提交应触发两次回调')
    assert.equal(received[0][0].name, 'Alex')
    assert.equal(received[1][1].age, 40)
  })

  test('isDirty 为 true 时条件应渲染「已编辑」提示条（契约判定）', () => {
    const initial = createInitialState(sampleData, sampleColumns)
    const editing = editableTableReducer(initial, { type: 'START_EDIT', row: 0, col: 'name' })
    const withValue = editableTableReducer(editing, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    const committed = editableTableReducer(withValue, { type: 'COMMIT_EDIT' })

    // PreviewPanel 第 112 行：{isDirty && (<div>已编辑</div>)}
    assert.equal(committed.isDirty, true, '提交后 isDirty 为 true，应显示提示条')
  })

  test('isDirty 为 false 时不渲染提示条', () => {
    const initial = createInitialState(sampleData, sampleColumns)
    assert.equal(initial.isDirty, false, '初始 isDirty 为 false，不应显示提示条')
  })

  test('预览数据为空时显示空状态（契约判定）', () => {
    // PreviewPanel：!hasData → 空状态
    assert.equal(hasData(null), false)
    assert.equal(hasData([]), false)
    assert.equal(hasData(undefined), false)
  })

  test('有数据时不显示空状态', () => {
    assert.equal(hasData(sampleData), true)
  })

  test.skip('「已编辑」提示条实际渲染到 DOM（需要 JSDOM）', () => {
    // 需 @testing-library/react + JSDOM 渲染 <PreviewPanel> 后
    // 断言 document 中存在「已编辑」文本节点。当前环境无 DOM，跳过。
  })

  test.skip('空状态占位符实际渲染到 DOM（需要 JSDOM）', () => {
    // 需 JSDOM 环境渲染 React 组件
  })
})
