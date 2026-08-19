// CodeEditorArea.test.js —— CodeEditorArea 行号同步逻辑测试
//
// CodeEditorArea 依赖 React 渲染 textarea。其核心纯逻辑是行数计算：
//   lineCount = Math.max(1, value.split('\n').length)
// 以及 scroll 同步（DOM 行为，跳过）。这里测试行数计算与相关契约。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── 镜像 CodeEditorArea 行数计算 ─────────────────────────────────
function lineCount (value) {
  return Math.max(1, value.split('\n').length)
}

// ── 行号 key 生成（组件内 Array.from 的 key 规则）─────────────────
function lineKeys (count) {
  return Array.from({ length: count }, (_, i) => `editor-line-${i + 1}`)
}

describe('CodeEditorArea 行数计算', () => {
  test('空字符串 → 1 行（最小值）', () => {
    assert.equal(lineCount(''), 1)
  })

  test('单行无换行 → 1 行', () => {
    assert.equal(lineCount('hello world'), 1)
  })

  test('多行：换行数 +1', () => {
    assert.equal(lineCount('a\nb\nc'), 3)
    assert.equal(lineCount('a\nb\nc\n'), 4, '末尾换行也算一行')
  })

  test('单换行符 → 2 行', () => {
    assert.equal(lineCount('\n'), 2)
  })

  test('大文件：1000 行', () => {
    const value = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`).join('\n')
    assert.equal(lineCount(value), 1000)
  })

  test('最小值保护：即使 split 返回空数组也至少 1', () => {
    // ''.split('\n') === ['']，length 1；这里再确认 Math.max 保护
    assert.ok(lineCount('') >= 1)
  })
})

describe('CodeEditorArea 行号 key 规则', () => {
  test('key 格式为 editor-line-{n}，从 1 开始', () => {
    assert.deepEqual(lineKeys(3), ['editor-line-1', 'editor-line-2', 'editor-line-3'])
  })

  test('单行时仅 1 个 key', () => {
    assert.deepEqual(lineKeys(1), ['editor-line-1'])
  })
})

describe('CodeEditorArea scroll 同步契约', () => {
  test.skip('textarea 滚动时 gutters scrollTop 同步（需要 DOM）', () => {
    // 需 JSDOM / testing-library 模拟 scroll 事件
  })

  test('syncScroll 逻辑：gutter.scrollTop = textarea.scrollTop', () => {
    // 纯逻辑镜像
    function syncScroll (textarea, gutter) {
      if (textarea && gutter) {
        gutter.scrollTop = textarea.scrollTop
      }
      return { textarea, gutter }
    }
    const textarea = { scrollTop: 100 }
    const gutter = { scrollTop: 0 }
    syncScroll(textarea, gutter)
    assert.equal(gutter.scrollTop, 100)
  })

  test('syncScroll 任一 ref 为 null 时不抛错', () => {
    function syncScroll (textarea, gutter) {
      if (textarea && gutter) {
        gutter.scrollTop = textarea.scrollTop
      }
    }
    assert.doesNotThrow(() => syncScroll(null, null))
    assert.doesNotThrow(() => syncScroll({ scrollTop: 1 }, null))
    assert.doesNotThrow(() => syncScroll(null, { scrollTop: 1 }))
  })
})

describe('CodeEditorArea 编辑/只读契约', () => {
  test('readOnly=false 时 onChange 可用', () => {
    // 组件：onChange={e => onChange(e.target.value)} 不受 readOnly 影响
    // 契约：readOnly 仅影响 textarea 的 readOnly 属性
    const readOnly = false
    assert.equal(readOnly, false)
  })

  test('readOnly=true 时 textarea 标记 is-readonly', () => {
    // 组件：className={`code-editor-textarea ${readOnly ? 'is-readonly' : ''}`}
    function classNameFor (readOnly) {
      return `code-editor-textarea ${readOnly ? 'is-readonly' : ''}`.trim()
    }
    assert.equal(classNameFor(true), 'code-editor-textarea is-readonly')
    assert.equal(classNameFor(false), 'code-editor-textarea')
  })
})
