// StatusBar.test.js —— StatusBar 状态显示逻辑测试
//
// StatusBar 是纯展示组件，其「条件渲染」逻辑完全由 props 决定。这里用纯函数
// 镜像其判定条件，验证在各种 props 组合下应显示/隐藏哪些片段。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── 镜像 StatusBar 条件判定 ──────────────────────────────────────
// StatusBar 接收 { sourceFormat, targetFormat, result, notice }
//   result: { rowCount, success, elapsed }
//   notice: { type, message } | null

// 路径显示：始终渲染（只要传入了格式）
function pathVisible (props) {
  return !!props.sourceFormat && !!props.targetFormat
}

// 数据条数：result.rowCount !== undefined && result.rowCount > 0
function rowCountVisible (result) {
  return result.rowCount !== undefined && result.rowCount > 0
}

// 耗时：result.success 为 true 时
function elapsedVisible (result) {
  return result.success === true
}

// notice 显示：notice 为 truthy
function noticeVisible (notice) {
  return !!notice
}

// 成功状态：无 notice && result.success → 显示 ✔ 成功
function successStatusVisible (result, notice) {
  return !notice && result.success === true
}

// 等待输入状态：无 notice && !result.success → 显示 ⚠ 等待输入
function waitingStatusVisible (result, notice) {
  return !notice && !result.success
}

// notice 类型 → 颜色
function noticeColor (notice) {
  return notice.type === 'error' ? 'var(--error)' : 'var(--success)'
}

// 大文件：>500 条
function isLargeFile (result) {
  return result.rowCount > 500
}

function makeProps (overrides = {}) {
  return {
    sourceFormat: 'json',
    targetFormat: 'yaml',
    result: { rowCount: 0, success: false, elapsed: 0 },
    notice: null,
    ...overrides
  }
}

describe('StatusBar 路径显示', () => {
  test('始终显示转换路径（源→JSON→目标）', () => {
    const props = makeProps({ sourceFormat: 'csv', targetFormat: 'mysql' })
    assert.equal(pathVisible(props), true)
    assert.match(props.sourceFormat.toUpperCase(), /CSV/)
    assert.match(props.targetFormat.toUpperCase(), /MYSQL/)
  })

  test('路径文本格式：SOURCE → JSON → TARGET', () => {
    const props = makeProps({ sourceFormat: 'json', targetFormat: 'yaml' })
    const expected = `${props.sourceFormat.toUpperCase()} → JSON → ${props.targetFormat.toUpperCase()}`
    assert.equal(expected, 'JSON → JSON → YAML')
  })
})

describe('StatusBar 数据条数显示', () => {
  test('rowCount > 0 时显示', () => {
    assert.equal(rowCountVisible({ rowCount: 5 }), true)
    assert.equal(rowCountVisible({ rowCount: 1 }), true)
  })

  test('rowCount = 0 时不显示', () => {
    assert.equal(rowCountVisible({ rowCount: 0 }), false)
  })

  test('rowCount = undefined 时不显示', () => {
    assert.equal(rowCountVisible({ rowCount: undefined }), false)
    assert.equal(rowCountVisible({}), false)
  })

  test('负数 rowCount 不显示（防御）', () => {
    assert.equal(rowCountVisible({ rowCount: -1 }), false)
  })
})

describe('StatusBar 耗时显示', () => {
  test('result.success 为 true 时显示耗时', () => {
    assert.equal(elapsedVisible({ success: true, elapsed: 50 }), true)
  })

  test('result.success 为 false/undefined 时不显示耗时', () => {
    assert.equal(elapsedVisible({ success: false }), false)
    assert.equal(elapsedVisible({}), false)
  })
})

describe('StatusBar notice 与状态互斥', () => {
  test('有 notice 时显示 notice.message，不显示成功/等待状态', () => {
    const notice = { type: 'error', message: '转换失败' }
    assert.equal(noticeVisible(notice), true)
    assert.equal(successStatusVisible({ success: true }, notice), false, '有 notice 时不应显示成功')
    assert.equal(waitingStatusVisible({ success: false }, notice), false, '有 notice 时不应显示等待')
  })

  test('无 notice 且 success → 显示成功', () => {
    assert.equal(successStatusVisible({ success: true }, null), true)
    assert.equal(waitingStatusVisible({ success: true }, null), false)
  })

  test('无 notice 且 !success → 显示等待输入', () => {
    assert.equal(successStatusVisible({ success: false }, null), false)
    assert.equal(waitingStatusVisible({ success: false }, null), true)
  })

  test('notice 类型决定颜色', () => {
    assert.equal(noticeColor({ type: 'error' }), 'var(--error)')
    assert.equal(noticeColor({ type: 'success' }), 'var(--success)')
    assert.equal(noticeColor({ type: 'info' }), 'var(--success)', '非 error 默认 success 色')
  })
})

describe('StatusBar 大文件判定', () => {
  test('rowCount > 500 视为大文件', () => {
    assert.equal(isLargeFile({ rowCount: 501 }), true)
    assert.equal(isLargeFile({ rowCount: 1000 }), true)
  })

  test('rowCount ≤ 500 非大文件', () => {
    assert.equal(isLargeFile({ rowCount: 500 }), false)
    assert.equal(isLargeFile({ rowCount: 1 }), false)
  })
})

describe('StatusBar 完整 props 矩阵', () => {
  test('初始状态：无结果、无 notice', () => {
    const props = makeProps()
    assert.equal(pathVisible(props), true)
    assert.equal(rowCountVisible(props.result), false)
    assert.equal(elapsedVisible(props.result), false)
    assert.equal(waitingStatusVisible(props.result, props.notice), true)
  })

  test('转换成功：有 rowCount、success、elapsed', () => {
    const props = makeProps({
      result: { rowCount: 10, success: true, elapsed: 42 }
    })
    assert.equal(rowCountVisible(props.result), true)
    assert.equal(elapsedVisible(props.result), true)
    assert.equal(successStatusVisible(props.result, props.notice), true)
  })

  test('转换失败：有 notice', () => {
    const props = makeProps({
      result: { rowCount: 0, success: false, elapsed: 0 },
      notice: { type: 'error', message: '解析错误' }
    })
    assert.equal(noticeVisible(props.notice), true)
    assert.equal(successStatusVisible(props.result, props.notice), false)
    assert.equal(waitingStatusVisible(props.result, props.notice), false)
  })

  test('大文件成功', () => {
    const props = makeProps({
      result: { rowCount: 1000, success: true, elapsed: 200 }
    })
    assert.equal(isLargeFile(props.result), true)
    assert.equal(rowCountVisible(props.result), true)
  })
})
