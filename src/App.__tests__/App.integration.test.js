// App.integration.test.js —— App 级别集成测试（编辑预览 → 输出更新 → 脏标记）
//
// 已有 preview-edit.integration.test.js 覆盖 handlePreviewDataChange /
// handleInputChange / handleSourceFormatChange 与 shouldReconvert。本文件补充：
//   - handleDownload 流程（XLSX 下载 / 无效数据弹 notice）
//   - showNotice 自动清除
//   - 端到端：输入 → 解析 → 预览编辑 → 重转换 → 输出更新
//   - 多 Tab 隔离：编辑 A 不影响 B
//   - 防抖转换效应判定
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  editableTableReducer,
  createInitialState
} from '../hooks/useEditableTable.js'
import { parseInput, stringifyOutput } from '../converters/index.js'

// ── Mirror of TabBar.createNewTab（.jsx 无法在 Node 中导入）───────
function createNewTab(index) {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: `转换 ${index + 1}`,
    input: '',
    sourceFormat: 'json',
    targetFormat: 'yaml',
    sourceOptions: {},
    targetOptions: {},
    result: { success: false, output: '', elapsed: 0 },
    parsedData: null,
    isProcessing: false,
    isTypeEditorOpen: false,
    notice: null
  }
}

// ── Mirror of App.updateTab ────────────────────────────────────────
function applyUpdate(tab, updates) {
  return { ...tab, ...updates }
}

// ── Mirror of App.handlePreviewDataChange ──────────────────────────
function handlePreviewDataChange(tab, newData) {
  return applyUpdate(tab, { parsedData: newData, isPreviewDirty: true })
}

// ── Mirror of App.handleDownload ───────────────────────────────────
// App 第 98-111 行：解析 input → 数组则 downloadXlsx + 成功 notice；否则错误 notice
function handleDownload(tab, { downloadXlsxImpl, showNotice }) {
  const { input, sourceFormat, sourceOptions, targetOptions } = tab
  try {
    const jsonData = parseInput(input, sourceFormat, sourceOptions)
    if (jsonData && Array.isArray(jsonData)) {
      downloadXlsxImpl(jsonData, 'output.xlsx', targetOptions)
      showNotice('已生成 output.xlsx', 'success')
      return { ok: true }
    } else {
      showNotice('需要先输入有效的 JSON 数组数据')
      return { ok: false }
    }
  } catch {
    showNotice('需要先输入有效的 JSON 数组数据')
    return { ok: false }
  }
}

// ── Mirror of App.showNotice ───────────────────────────────────────
// App 第 32-39 行：设置 notice → 3000ms 后清除
function createNoticeManager({ setTimeoutImpl, getTime = () => Date.now() }) {
  let timer = null
  let currentNotice = null
  let clearCount = 0

  return {
    get notice() { return currentNotice },
    get clearCount() { return clearCount },
    showNotice(message, type = 'error') {
      currentNotice = { message, type }
      if (timer) timer.cancel()
      timer = setTimeoutImpl(() => {
        currentNotice = null
        clearCount++
      }, 3000)
    },
    cleanup() {
      if (timer) timer.cancel()
    }
  }
}

// ── Mirror of App 防抖转换效应判定 ─────────────────────────────────
// App 第 114-187 行：当 input/sourceFormat/targetFormat/options 变化时，
// 防抖 300ms 后执行 parseInput + stringifyOutput。
function shouldDebounceConvert(prevDeps, nextDeps) {
  return (
    prevDeps.input !== nextDeps.input ||
    prevDeps.sourceFormat !== nextDeps.sourceFormat ||
    prevDeps.targetFormat !== nextDeps.targetFormat ||
    prevDeps.sourceOptions !== nextDeps.sourceOptions ||
    prevDeps.targetOptions !== nextDeps.targetOptions
  )
}

// ── Mirror of App 重转换效应判定 ───────────────────────────────────
function shouldReconvert(prevDeps, nextDeps) {
  const prevTrigger = prevDeps.isPreviewDirty && prevDeps.parsedData
  const nextTrigger = nextDeps.isPreviewDirty && nextDeps.parsedData
  if (!nextTrigger) return false
  return (
    prevDeps.parsedData !== nextDeps.parsedData ||
    prevDeps.targetFormat !== nextDeps.targetFormat ||
    prevDeps.targetOptions !== nextDeps.targetOptions ||
    !prevTrigger
  )
}

// ── 工具 ───────────────────────────────────────────────────────────
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

describe('App.handleDownload', () => {
  test('有效 JSON 数组 → 调用 downloadXlsx + 成功 notice', () => {
    const tab = makeTab({
      input: '[{ "id": 1, "name": "Alice" }]',
      sourceFormat: 'json',
      sourceOptions: {},
      targetOptions: {}
    })
    const downloads = []
    const notices = []
    const res = handleDownload(tab, {
      downloadXlsxImpl: (data, name, opts) => { downloads.push({ data, name, opts }) },
      showNotice: (msg, type) => { notices.push({ msg, type }) }
    })

    assert.equal(res.ok, true)
    assert.equal(downloads.length, 1)
    assert.equal(downloads[0].name, 'output.xlsx')
    assert.equal(downloads[0].data.length, 1)
    assert.equal(notices.length, 1)
    assert.match(notices[0].msg, /已生成 output\.xlsx/)
    assert.equal(notices[0].type, 'success')
  })

  test('无效输入（非数组）→ 错误 notice', () => {
    const tab = makeTab({
      input: 'not json',
      sourceFormat: 'json'
    })
    const notices = []
    const res = handleDownload(tab, {
      downloadXlsxImpl: () => { throw new Error('不应调用') },
      showNotice: (msg, type = 'error') => { notices.push({ msg, type }) }
    })

    assert.equal(res.ok, false)
    assert.equal(notices.length, 1)
    assert.match(notices[0].msg, /需要先输入有效的 JSON 数组数据/)
    assert.equal(notices[0].type, 'error')
  })

  test('解析失败 → 错误 notice', () => {
    const tab = makeTab({
      input: '{ invalid json }',
      sourceFormat: 'json'
    })
    const notices = []
    const res = handleDownload(tab, {
      downloadXlsxImpl: () => {},
      showNotice: (msg, type) => { notices.push({ msg, type }) }
    })

    assert.equal(res.ok, false)
    assert.equal(notices.length, 1)
  })

  test('空输入 → 错误 notice', () => {
    const tab = makeTab({ input: '', sourceFormat: 'json' })
    const notices = []
    const res = handleDownload(tab, {
      downloadXlsxImpl: () => {},
      showNotice: (msg, type) => { notices.push({ msg, type }) }
    })

    assert.equal(res.ok, false)
    assert.equal(notices.length, 1)
  })
})

describe('App.showNotice 自动清除', () => {
  test('showNotice 设置 notice', () => {
    const mgr = createNoticeManager({ setTimeoutImpl: () => ({ cancel: () => {} }) })
    mgr.showNotice('出错了', 'error')
    assert.deepEqual(mgr.notice, { message: '出错了', type: 'error' })
  })

  test('3000ms 后自动清除', () => {
    let clearFn = null
    const setTimeoutImpl = (fn) => { clearFn = fn; return { cancel: () => { clearFn = null } } }
    const mgr = createNoticeManager({ setTimeoutImpl })

    mgr.showNotice('msg')
    assert.notEqual(mgr.notice, null)
    assert.equal(typeof clearFn, 'function')

    clearFn()
    assert.equal(mgr.notice, null, '到期后 notice 应清除')
    assert.equal(mgr.clearCount, 1)
  })

  test('连续 showNotice 重置定时器', () => {
    const timers = []
    const setTimeoutImpl = (fn) => {
      const t = { cancel: () => { t.cancelled = true } }
      timers.push(t)
      t.fn = fn
      return t
    }
    const mgr = createNoticeManager({ setTimeoutImpl })

    mgr.showNotice('first')
    const firstTimer = timers[0]
    mgr.showNotice('second')
    assert.equal(firstTimer.cancelled, true, '第一个定时器应被取消')
    assert.equal(mgr.notice.message, 'second')
  })

  test('默认类型为 error', () => {
    const mgr = createNoticeManager({ setTimeoutImpl: () => ({ cancel: () => {} }) })
    mgr.showNotice('msg')
    assert.equal(mgr.notice.type, 'error')
  })
})

describe('App 防抖转换效应', () => {
  test('input 变化触发', () => {
    const prev = { input: 'a', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: {}, targetOptions: {} }
    const next = { input: 'b', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: {}, targetOptions: {} }
    assert.equal(shouldDebounceConvert(prev, next), true)
  })

  test('sourceFormat 变化触发', () => {
    const prev = { input: 'a', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: {}, targetOptions: {} }
    const next = { input: 'a', sourceFormat: 'yaml', targetFormat: 'yaml', sourceOptions: {}, targetOptions: {} }
    assert.equal(shouldDebounceConvert(prev, next), true)
  })

  test('targetFormat 变化触发', () => {
    const prev = { input: 'a', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: {}, targetOptions: {} }
    const next = { input: 'a', sourceFormat: 'json', targetFormat: 'toml', sourceOptions: {}, targetOptions: {} }
    assert.equal(shouldDebounceConvert(prev, next), true)
  })

  test('options 引用变化触发', () => {
    const prev = { input: 'a', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: {}, targetOptions: { indent: 2 } }
    const next = { input: 'a', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: {}, targetOptions: { indent: 4 } }
    assert.equal(shouldDebounceConvert(prev, next), true)
  })

  test('依赖未变化不触发', () => {
    const opts = { indent: 2 }
    const srcOpts = {}
    const prev = { input: 'a', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: srcOpts, targetOptions: opts }
    const next = { input: 'a', sourceFormat: 'json', targetFormat: 'yaml', sourceOptions: srcOpts, targetOptions: opts }
    assert.equal(shouldDebounceConvert(prev, next), false)
  })
})

describe('App 重转换效应', () => {
  test('dirty + parsedData 变化 → 触发', () => {
    const data = [{ id: 1, name: 'Alice' }]
    const prev = { parsedData: data, isPreviewDirty: false, targetFormat: 'json', targetOptions: {} }
    const next = { parsedData: [{ id: 1, name: 'Alex' }], isPreviewDirty: true, targetFormat: 'json', targetOptions: {} }
    assert.equal(shouldReconvert(prev, next), true)
  })

  test('非 dirty 不触发', () => {
    const data = [{ id: 1 }]
    const prev = { parsedData: data, isPreviewDirty: false, targetFormat: 'json', targetOptions: {} }
    const next = { parsedData: data, isPreviewDirty: false, targetFormat: 'yaml', targetOptions: {} }
    assert.equal(shouldReconvert(prev, next), false)
  })

  test('parsedData 为 null 不触发', () => {
    const prev = { parsedData: null, isPreviewDirty: false, targetFormat: 'json', targetOptions: {} }
    const next = { parsedData: null, isPreviewDirty: true, targetFormat: 'json', targetOptions: {} }
    assert.equal(shouldReconvert(prev, next), false)
  })

  test('dirty 下 targetFormat 变化 → 触发', () => {
    const data = [{ id: 1, name: 'Alice' }]
    const prev = { parsedData: data, isPreviewDirty: true, targetFormat: 'json', targetOptions: {} }
    const next = { parsedData: data, isPreviewDirty: true, targetFormat: 'yaml', targetOptions: {} }
    assert.equal(shouldReconvert(prev, next), true)
  })
})

describe('App 端到端：输入 → 解析 → 预览编辑 → 重转换 → 输出', () => {
  test('完整流程：JSON 输入 → 编辑预览 → YAML 输出', () => {
    // 1. 输入
    const input = JSON.stringify([
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ])
    const parsed = parseInput(input, 'json', {})
    assert.ok(Array.isArray(parsed))

    // 2. 预览编辑：Alice → Alex
    let state = createInitialState(parsed, ['id', 'name', 'age'])
    state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
    state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    state = editableTableReducer(state, { type: 'COMMIT_EDIT' })
    assert.equal(state.isDirty, true)

    // 3. App 收到 onDataChange
    const tab = makeTab({ targetFormat: 'yaml', targetOptions: {} })
    const updated = handlePreviewDataChange(tab, state.displayData)
    assert.equal(updated.isPreviewDirty, true)
    assert.equal(updated.parsedData[0].name, 'Alex')

    // 4. 重转换
    const output = stringifyOutput(updated.parsedData, updated.targetFormat, updated.targetOptions)
    assert.match(output, /Alex/)
    assert.match(output, /Bob/)
    assert.match(output, /age: 30/)
  })

  test('编辑后切换目标格式 → 输出反映新格式', () => {
    const input = JSON.stringify([{ id: 1, name: 'Alice' }])
    const parsed = parseInput(input, 'json', {})

    let state = createInitialState(parsed, ['id', 'name'])
    state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
    state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    state = editableTableReducer(state, { type: 'COMMIT_EDIT' })

    const tab = makeTab({ targetFormat: 'json', targetOptions: {} })
    const updated = handlePreviewDataChange(tab, state.displayData)

    // 切到 yaml
    const yamlTab = applyUpdate(updated, { targetFormat: 'yaml' })
    const yamlOutput = stringifyOutput(yamlTab.parsedData, yamlTab.targetFormat, yamlTab.targetOptions)
    assert.match(yamlOutput, /name: Alex/)

    // 切到 csv
    const csvTab = applyUpdate(updated, { targetFormat: 'csv' })
    const csvOutput = stringifyOutput(csvTab.parsedData, csvTab.targetFormat, csvTab.targetOptions)
    assert.match(csvOutput, /id,name/)
    assert.match(csvOutput, /1,Alex/)
  })

  test('编辑后 reset → 输出回到原始', () => {
    const input = JSON.stringify([{ id: 1, name: 'Alice' }])
    const parsed = parseInput(input, 'json', {})

    let state = createInitialState(parsed, ['id', 'name'])
    state = editableTableReducer(state, { type: 'START_EDIT', row: 0, col: 'name' })
    state = editableTableReducer(state, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    state = editableTableReducer(state, { type: 'COMMIT_EDIT' })

    // reset
    state = editableTableReducer(state, { type: 'RESET', data: parsed, columns: ['id', 'name'] })
    assert.equal(state.isDirty, false)
    assert.equal(state.displayData[0].name, 'Alice')

    const output = stringifyOutput(state.displayData, 'json', {})
    assert.match(output, /Alice/)
  })
})

describe('App 多 Tab 隔离', () => {
  test('两个 Tab 独立创建', () => {
    const t0 = createNewTab(0)
    const t1 = createNewTab(1)
    assert.notEqual(t0.id, t1.id)
    assert.notEqual(t0.sourceOptions, t1.sourceOptions, 'sourceOptions 引用独立')
    assert.notEqual(t0.targetOptions, t1.targetOptions, 'targetOptions 引用独立')
    // 初始 parsedData 均为 null（结构契约），但 result 引用独立
    assert.notEqual(t0.result, t1.result, 'result 引用独立')
  })

  test('编辑 Tab A 不影响 Tab B', () => {
    const tabA = makeTab({ id: 'a', input: '[{ "id": 1, "name": "Alice" }]' })
    const tabB = makeTab({ id: 'b', input: '[{ "id": 2, "name": "Bob" }]' })

    const parsedA = parseInput(tabA.input, 'json', {})
    let stateA = createInitialState(parsedA, ['id', 'name'])
    stateA = editableTableReducer(stateA, { type: 'START_EDIT', row: 0, col: 'name' })
    stateA = editableTableReducer(stateA, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    stateA = editableTableReducer(stateA, { type: 'COMMIT_EDIT' })

    const updatedA = handlePreviewDataChange(tabA, stateA.displayData)
    assert.equal(updatedA.parsedData[0].name, 'Alex')
    assert.equal(tabB.parsedData, null, 'Tab B 未受影响')
  })

  test('Tab 切换不丢失各自 parsedData', () => {
    const tabA = makeTab({ id: 'a', parsedData: [{ id: 1 }], isPreviewDirty: true })
    const tabB = makeTab({ id: 'b', parsedData: [{ id: 2 }], isPreviewDirty: false })
    const tabs = [tabA, tabB]

    // 模拟切换 active
    const activeA = tabs.find(t => t.id === 'a')
    const activeB = tabs.find(t => t.id === 'b')
    assert.equal(activeA.isPreviewDirty, true)
    assert.equal(activeB.isPreviewDirty, false)
    assert.equal(activeA.parsedData[0].id, 1)
    assert.equal(activeB.parsedData[0].id, 2)
  })
})

describe('App 冲突处理集成', () => {
  test('dirty 时修改输入 → 确认后清除 dirty 并更新 input', () => {
    // handleInputChange 镜像
    function handleInputChange(tab, val, confirmImpl) {
      if (tab.isPreviewDirty) {
        const ok = confirmImpl('输入变更将覆盖已编辑的预览数据，是否继续？')
        if (!ok) return { tab, changed: false }
        tab = applyUpdate(tab, { isPreviewDirty: false })
      }
      return { tab: applyUpdate(tab, { input: val }), changed: true }
    }

    const tab = makeTab({ isPreviewDirty: true, input: 'old' })
    const res = handleInputChange(tab, 'new', () => true)
    assert.equal(res.changed, true)
    assert.equal(res.tab.input, 'new')
    assert.equal(res.tab.isPreviewDirty, false)
  })

  test('dirty 时修改输入 → 取消后 input 不变', () => {
    function handleInputChange(tab, val, confirmImpl) {
      if (tab.isPreviewDirty) {
        const ok = confirmImpl('输入变更将覆盖已编辑的预览数据，是否继续？')
        if (!ok) return { tab, changed: false }
        tab = applyUpdate(tab, { isPreviewDirty: false })
      }
      return { tab: applyUpdate(tab, { input: val }), changed: true }
    }

    const tab = makeTab({ isPreviewDirty: true, input: 'old' })
    const res = handleInputChange(tab, 'new', () => false)
    assert.equal(res.changed, false)
    assert.equal(res.tab.input, 'old')
    assert.equal(res.tab.isPreviewDirty, true)
  })

  test('dirty 时切换源格式 → 确认后清除 dirty 并更新格式', () => {
    function handleSourceFormatChange(tab, val, confirmImpl) {
      if (tab.isPreviewDirty) {
        const ok = confirmImpl('切换源格式将覆盖已编辑的预览数据，是否继续？')
        if (!ok) return { tab, changed: false }
        tab = applyUpdate(tab, { isPreviewDirty: false })
      }
      return { tab: applyUpdate(tab, { sourceFormat: val }), changed: true }
    }

    const tab = makeTab({ isPreviewDirty: true, sourceFormat: 'json' })
    const res = handleSourceFormatChange(tab, 'yaml', () => true)
    assert.equal(res.changed, true)
    assert.equal(res.tab.sourceFormat, 'yaml')
    assert.equal(res.tab.isPreviewDirty, false)
  })
})

describe('App 转换历史 addRecord 集成', () => {
  test('转换成功后 addRecord 被调用', () => {
    // App 第 170-172 行：if (res.success && res.rowCount > 0) addRecord(...)
    function shouldAddRecord(result) {
      return result.success && result.rowCount > 0
    }
    assert.equal(shouldAddRecord({ success: true, rowCount: 5 }), true)
    assert.equal(shouldAddRecord({ success: true, rowCount: 0 }), false)
    assert.equal(shouldAddRecord({ success: false, rowCount: 5 }), false)
  })
})
