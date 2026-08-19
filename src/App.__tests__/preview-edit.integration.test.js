// App.preview-edit.integration.test.js —— App 编辑流程集成测试
//
// App 是 React 组件，项目无 JSDOM / testing-library，无法真实渲染。
// 这里以纯函数镜像 App 中与预览编辑相关的 handler 与 effect 判定逻辑
//（已标注「mirror of App」），验证可观察的外部行为契约：
//   - handlePreviewDataChange 更新 parsedData / isPreviewDirty
//   - handleInputChange / handleSourceFormatChange 在 dirty 时弹确认框
//   - 目标格式在 dirty 变更时触发重新转换
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  editableTableReducer,
  createInitialState
} from '../hooks/useEditableTable.js'
import { parseInput, stringifyOutput } from '../converters/index.js'

// ── Mirror of App.updateTab ──────────────────────────────────────
// App 第 28-30 行：setTabs(prev => prev.map(t => t.id===id ? {...t,...updates} : t))
function applyUpdate(tab, updates) {
  return { ...tab, ...updates }
}

// ── Mirror of App.handlePreviewDataChange ────────────────────────
// App 第 209-211 行
function handlePreviewDataChange(tab, activeTabId, newData) {
  return applyUpdate(tab, { parsedData: newData, isPreviewDirty: true })
}

// ── Mirror of App.handleInputChange ──────────────────────────────
// App 第 190-198 行：dirty 时 window.confirm；确认后重置脏标记再更新 input
function handleInputChange(tab, val, confirmImpl) {
  if (tab.isPreviewDirty) {
    const ok = confirmImpl('输入变更将覆盖已编辑的预览数据，是否继续？')
    if (!ok) return { tab, changed: false }
    tab = applyUpdate(tab, { isPreviewDirty: false })
  }
  return { tab: applyUpdate(tab, { input: val }), changed: true }
}

// ── Mirror of App.handleSourceFormatChange ───────────────────────
// App 第 201-208 行
function handleSourceFormatChange(tab, val, confirmImpl) {
  if (tab.isPreviewDirty) {
    const ok = confirmImpl('切换源格式将覆盖已编辑的预览数据，是否继续？')
    if (!ok) return { tab, changed: false }
    tab = applyUpdate(tab, { isPreviewDirty: false })
  }
  return { tab: applyUpdate(tab, { sourceFormat: val }), changed: true }
}

// ── Mirror of App 重新转换效应判定 ────────────────────────────────
// App 第 214-240 行：当 parsedData/isPreviewDirty/targetFormat/targetOptions 变化时，
// 若 isPreviewDirty && parsedData 存在，则重新 stringify。
// 这里只判定「是否触发重新转换」，不实际调度 timer。
function shouldReconvert(prevDeps, nextDeps) {
  const prevTrigger = prevDeps.isPreviewDirty && prevDeps.parsedData
  const nextTrigger = nextDeps.isPreviewDirty && nextDeps.parsedData
  // 触发条件：触发态为真，且依赖项（parsedData/targetFormat/targetOptions）之一变化
  if (!nextTrigger) return false
  return (
    prevDeps.parsedData !== nextDeps.parsedData ||
    prevDeps.targetFormat !== nextDeps.targetFormat ||
    prevDeps.targetOptions !== nextDeps.targetOptions ||
    !prevTrigger
  )
}

function makeTab(overrides = {}) {
  return {
    id: 'tab-1',
    input: '',
    sourceFormat: 'json',
    targetFormat: 'json',
    sourceOptions: {},
    targetOptions: {},
    parsedData: null,
    result: null,
    isPreviewDirty: false,
    isProcessing: false,
    notice: null,
    name: 'Tab',
    ...overrides
  }
}

describe('App 预览编辑集成', () => {
  test('handlePreviewDataChange 更新 parsedData 并标记 dirty', () => {
    const tab = makeTab({ parsedData: [{ id: 1, name: 'Alice' }] })
    const newData = [{ id: 1, name: 'Alex' }]
    const updated = handlePreviewDataChange(tab, tab.id, newData)

    assert.deepEqual(updated.parsedData, newData)
    assert.equal(updated.isPreviewDirty, true)
    // 不应影响其它字段
    assert.equal(updated.targetFormat, 'json')
  })

  test('handleInputChange: dirty 时用户确认 → 更新 input 并清除脏标记', () => {
    const tab = makeTab({ isPreviewDirty: true, input: 'old' })
    const res = handleInputChange(tab, 'new-input', () => true /* confirm ok */)

    assert.equal(res.changed, true)
    assert.equal(res.tab.input, 'new-input')
    assert.equal(res.tab.isPreviewDirty, false, '确认后脏标记应清除')
  })

  test('handleInputChange: dirty 时用户取消 → input 不变', () => {
    const tab = makeTab({ isPreviewDirty: true, input: 'old' })
    const res = handleInputChange(tab, 'new-input', () => false /* confirm cancel */)

    assert.equal(res.changed, false, '取消后不应更新')
    assert.equal(res.tab.input, 'old')
    assert.equal(res.tab.isPreviewDirty, true, '取消后脏标记保留')
  })

  test('handleInputChange: 非 dirty 时直接更新 input', () => {
    const tab = makeTab({ isPreviewDirty: false, input: 'old' })
    const res = handleInputChange(tab, 'new-input', () => { throw new Error('不应弹确认框') })

    assert.equal(res.changed, true)
    assert.equal(res.tab.input, 'new-input')
  })

  test('handleSourceFormatChange: dirty 时取消 → 格式不变', () => {
    const tab = makeTab({ isPreviewDirty: true, sourceFormat: 'json' })
    const res = handleSourceFormatChange(tab, 'yaml', () => false)

    assert.equal(res.changed, false)
    assert.equal(res.tab.sourceFormat, 'json')
  })

  test('handleSourceFormatChange: dirty 时确认 → 切换格式并清除脏标记', () => {
    const tab = makeTab({ isPreviewDirty: true, sourceFormat: 'json' })
    const res = handleSourceFormatChange(tab, 'yaml', () => true)

    assert.equal(res.changed, true)
    assert.equal(res.tab.sourceFormat, 'yaml')
    assert.equal(res.tab.isPreviewDirty, false)
  })

  test('重新转换效应: parsedData 变化且 dirty → 触发重新 stringify', () => {
    const tab = makeTab({
      isPreviewDirty: true,
      parsedData: [{ id: 1, name: 'Alice' }],
      targetFormat: 'json',
      targetOptions: {}
    })
    // 模拟 PreviewPanel 编辑后产生新 parsedData
    const edited = handlePreviewDataChange(tab, tab.id, [{ id: 1, name: 'Alex' }])

    const prevDeps = {
      parsedData: tab.parsedData,
      isPreviewDirty: tab.isPreviewDirty,
      targetFormat: tab.targetFormat,
      targetOptions: tab.targetOptions
    }
    const nextDeps = {
      parsedData: edited.parsedData,
      isPreviewDirty: edited.isPreviewDirty,
      targetFormat: edited.targetFormat,
      targetOptions: edited.targetOptions
    }

    assert.equal(shouldReconvert(prevDeps, nextDeps), true, 'parsedData 变化应触发重新转换')

    // 实际 stringify 结果应反映编辑后的数据
    const output = stringifyOutput(edited.parsedData, edited.targetFormat, edited.targetOptions)
    assert.match(output, /Alex/)
  })

  test('重新转换效应: 目标格式在 dirty 下变更 → 触发重新转换', () => {
    const data = [{ id: 1, name: 'Alice' }]
    const tab = makeTab({
      isPreviewDirty: true,
      parsedData: data,
      targetFormat: 'json',
      targetOptions: {}
    })
    const edited = applyUpdate(tab, { targetFormat: 'yaml' })

    const prevDeps = { parsedData: data, isPreviewDirty: true, targetFormat: 'json', targetOptions: {} }
    const nextDeps = { parsedData: data, isPreviewDirty: true, targetFormat: 'yaml', targetOptions: {} }

    assert.equal(shouldReconvert(prevDeps, nextDeps), true, '目标格式变化应触发重新转换')
    const output = stringifyOutput(data, 'yaml', {})
    assert.match(output, /Alice/)
  })

  test('重新转换效应: 非 dirty 时不触发', () => {
    const data = [{ id: 1 }]
    const prevDeps = { parsedData: data, isPreviewDirty: false, targetFormat: 'json', targetOptions: {} }
    const nextDeps = { parsedData: data, isPreviewDirty: false, targetFormat: 'yaml', targetOptions: {} }

    assert.equal(shouldReconvert(prevDeps, nextDeps), false, '非 dirty 时即使格式变也不触发预览重转换')
  })

  test('端到端：编辑预览 → 标记 dirty → 重新转换输出一致', () => {
    // 1. 初始输入解析
    const input = JSON.stringify([
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ])
    const parsed = parseInput(input, 'json', {})
    assert.ok(Array.isArray(parsed))

    // 2. 模拟 PreviewPanel 内编辑：把 Alice 改成 Alex
    let state = createInitialState(parsed, ['id', 'name', 'age'])
    state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
    state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    state = editableTableReducer(state, { type: 'COMMIT_EDIT' })
    assert.equal(state.isDirty, true)

    // 3. App 收到 onDataChange → 更新 parsedData + dirty
    const tab = makeTab({ targetFormat: 'json', targetOptions: {} })
    const updated = handlePreviewDataChange(tab, tab.id, state.displayData)
    assert.equal(updated.isPreviewDirty, true)
    assert.equal(updated.parsedData[0].name, 'Alex')

    // 4. 重新转换输出应包含 Alex
    const output = stringifyOutput(updated.parsedData, updated.targetFormat, updated.targetOptions)
    const reparsed = JSON.parse(output)
    assert.equal(reparsed[0].name, 'Alex')
    assert.equal(reparsed[1].name, 'Bob')
  })

  test.skip('实际 window.confirm 对话框渲染（需要 JSDOM）', () => {
    // 需 JSDOM 环境模拟 window.confirm 与 DOM 交互
  })
})
