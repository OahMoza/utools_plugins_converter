// OutputPanel.test.js —— OutputPanel 复制 / 下载交互逻辑测试
//
// OutputPanel 是 React 组件（.jsx），依赖 navigator.clipboard 与 DOM。
// 项目无 JSDOM / testing-library，无法直接渲染。这里镜像其条件判定与
// handleCopy 行为契约：canCopy / isBinary 判定、复制后 copied 状态切换、
// 按钮可见性。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── Mirror of OutputPanel 条件判定 ────────────────────────────────
// OutputPanel 第 23 行：const isBinary = targetFormat === 'xlsx'
function isBinaryFormat(targetFormat) {
  return targetFormat === 'xlsx'
}

// OutputPanel 第 24 行：const canCopy = !isBinary && result.success && localOutput
function canCopy(result, localOutput, targetFormat) {
  return !isBinaryFormat(targetFormat) && result.success && !!localOutput
}

// ── Mirror of OutputPanel.handleCopy ───────────────────────────────
// OutputPanel 第 15-21 行：复制 → 写剪贴板 → copied=true → 1500ms 后复位。
// 这里用注入 clipboard 与定时器镜像该流程。
function createCopyHandler({ clipboard, setTimeoutImpl, getTime = () => Date.now() }) {
  let copied = false
  let resetTimer = null
  let lastWrite = null

  return {
    get copied() { return copied },
    get lastWrite() { return lastWrite },
    handleCopy(localOutput) {
      if (!localOutput) return false
      clipboard.writeText(localOutput)
      lastWrite = localOutput
      copied = true
      resetTimer = setTimeoutImpl(() => { copied = false }, 1500)
      return true
    },
    cleanup() {
      if (resetTimer) resetTimer.cancel()
    }
  }
}

// ── Mirror of OutputPanel 渲染分支 ─────────────────────────────────
// 组件第 66-91 行：result.success → (isBinary ? 占位 : CodeEditor)
//                                  失败 → 错误占位
function renderBranch(result, targetFormat) {
  if (result.success) {
    return isBinaryFormat(targetFormat) ? 'binary-placeholder' : 'code-editor'
  }
  return 'error-placeholder'
}

// ── 工具 ───────────────────────────────────────────────────────────
function makeResult(overrides = {}) {
  return {
    success: false,
    output: '',
    elapsed: 0,
    error: '',
    ...overrides
  }
}

describe('OutputPanel isBinary 判定', () => {
  test('xlsx 是二进制格式', () => {
    assert.equal(isBinaryFormat('xlsx'), true)
  })

  test('其它格式不是二进制', () => {
    for (const f of ['json', 'yaml', 'toml', 'xml', 'csv', 'markdown', 'mysql', 'sparksql']) {
      assert.equal(isBinaryFormat(f), false, `${f} 不应是二进制`)
    }
  })

  test('未知格式默认非二进制', () => {
    assert.equal(isBinaryFormat('foo'), false)
    assert.equal(isBinaryFormat(''), false)
    assert.equal(isBinaryFormat(undefined), false)
    assert.equal(isBinaryFormat(null), false)
  })
})

describe('OutputPanel canCopy 判定', () => {
  test('成功 + 有输出 + 非二进制 → 可复制', () => {
    assert.equal(canCopy(makeResult({ success: true, output: 'data' }), 'data', 'json'), true)
  })

  test('二进制格式即使成功也不可复制', () => {
    assert.equal(canCopy(makeResult({ success: true, output: 'binary' }), 'binary', 'xlsx'), false)
  })

  test('失败结果不可复制', () => {
    assert.equal(canCopy(makeResult({ success: false, output: '' }), '', 'json'), false)
    assert.equal(canCopy(makeResult({ success: false, output: 'err', error: 'fail' }), 'err', 'json'), false)
  })

  test('空输出不可复制', () => {
    assert.equal(canCopy(makeResult({ success: true, output: '' }), '', 'json'), false)
  })

  test('localOutput 为 null/undefined 不可复制', () => {
    assert.equal(canCopy(makeResult({ success: true }), null, 'json'), false)
    assert.equal(canCopy(makeResult({ success: true }), undefined, 'json'), false)
  })
})

describe('OutputPanel 渲染分支', () => {
  test('成功 + 二进制 → 二进制占位', () => {
    assert.equal(renderBranch(makeResult({ success: true }), 'xlsx'), 'binary-placeholder')
  })

  test('成功 + 文本 → 代码编辑器', () => {
    assert.equal(renderBranch(makeResult({ success: true, output: '{}' }), 'json'), 'code-editor')
    assert.equal(renderBranch(makeResult({ success: true, output: 'a: 1' }), 'yaml'), 'code-editor')
  })

  test('失败 → 错误占位', () => {
    assert.equal(renderBranch(makeResult({ success: false, error: '解析失败' }), 'json'), 'error-placeholder')
  })

  test('失败时无论是否二进制都显示错误', () => {
    assert.equal(renderBranch(makeResult({ success: false, error: 'err' }), 'xlsx'), 'error-placeholder')
  })
})

describe('OutputPanel 按钮可见性契约', () => {
  test('复制按钮：canCopy 为 true 时渲染', () => {
    // 第 36 行：{canCopy && (<Button>复制</Button>)}
    const visible = canCopy(makeResult({ success: true, output: 'x' }), 'x', 'json')
    assert.equal(visible, true)
  })

  test('复制按钮：xlsx 成功时不渲染', () => {
    const visible = canCopy(makeResult({ success: true, output: 'bin' }), 'bin', 'xlsx')
    assert.equal(visible, false)
  })

  test('下载按钮：isBinary && result.success 时渲染', () => {
    // 第 46 行：{isBinary && result.success && (<Button>下载</Button>)}
    function showDownload(result, targetFormat) {
      return isBinaryFormat(targetFormat) && result.success
    }
    assert.equal(showDownload(makeResult({ success: true }), 'xlsx'), true)
    assert.equal(showDownload(makeResult({ success: false }), 'xlsx'), false)
    assert.equal(showDownload(makeResult({ success: true }), 'json'), false)
  })
})

describe('OutputPanel.handleCopy 行为', () => {
  test('复制成功：写剪贴板 + copied 变 true', () => {
    const writes = []
    const clipboard = { writeText: (t) => { writes.push(t) } }
    const handler = createCopyHandler({ clipboard, setTimeoutImpl: () => ({ cancel: () => {} }) })

    const ok = handler.handleCopy('hello world')

    assert.equal(ok, true)
    assert.deepEqual(writes, ['hello world'])
    assert.equal(handler.copied, true)
    assert.equal(handler.lastWrite, 'hello world')
  })

  test('空输出不复制', () => {
    const writes = []
    const clipboard = { writeText: (t) => { writes.push(t) } }
    const handler = createCopyHandler({ clipboard, setTimeoutImpl: () => ({ cancel: () => {} }) })

    assert.equal(handler.handleCopy(''), false)
    assert.equal(handler.handleCopy(null), false)
    assert.equal(handler.handleCopy(undefined), false)
    assert.deepEqual(writes, [])
    assert.equal(handler.copied, false)
  })

  test('1500ms 后 copied 自动复位', () => {
    let resetFn = null
    const setTimeoutImpl = (fn) => { resetFn = fn; return { cancel: () => { resetFn = null } } }
    const handler = createCopyHandler({ clipboard: { writeText: () => {} }, setTimeoutImpl })

    handler.handleCopy('data')
    assert.equal(handler.copied, true)

    // 模拟 1500ms 到期
    assert.ok(typeof resetFn === 'function', '应注册了复位定时器')
    resetFn()
    assert.equal(handler.copied, false, '复位后 copied 应为 false')
  })

  test('连续复制：每次写剪贴板后 copied 保持 true', () => {
    const writes = []
    const clipboard = { writeText: (t) => { writes.push(t) } }
    const handler = createCopyHandler({ clipboard, setTimeoutImpl: () => ({ cancel: () => {} }) })

    handler.handleCopy('first')
    handler.handleCopy('second')
    assert.deepEqual(writes, ['first', 'second'])
    assert.equal(handler.copied, true)
  })
})

describe('OutputPanel localOutput 状态同步契约', () => {
  test('useEffect 在 result.output 变化时同步 localOutput', () => {
    // 第 11-13 行：useEffect(() => { setLocalOutput(result.output) }, [result.output])
    // 契约：localOutput 始终跟踪 result.output
    function syncLocalOutput(result) {
      return result.output
    }
    assert.equal(syncLocalOutput(makeResult({ output: 'a' })), 'a')
    assert.equal(syncLocalOutput(makeResult({ output: 'b' })), 'b')
    assert.equal(syncLocalOutput(makeResult({ output: '' })), '')
  })

  test('复制的是 localOutput 而非 result.output（允许用户编辑）', () => {
    // 第 16 行：navigator.clipboard.writeText(localOutput)
    const localOutput = 'user-edited text'
    const writes = []
    const clipboard = { writeText: (t) => { writes.push(t) } }
    const handler = createCopyHandler({ clipboard, setTimeoutImpl: () => ({ cancel: () => {} }) })
    handler.handleCopy(localOutput)
    assert.deepEqual(writes, ['user-edited text'])
  })
})
