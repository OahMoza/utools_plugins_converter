// TabBar.test.js —— TabBar 纯逻辑测试
//
// TabBar 是 React 组件（.jsx），项目无 JSDOM / testing-library，无法直接渲染。
// createNewTab 是模块级纯函数（无 React 依赖），但定义在 TabBar.jsx 内无法被
// Node 直接导入。这里镜像该函数并验证其契约；同时镜像 App 的 Tab 操作
//（handleTabAdd / handleTabClose / handleTabSelect）判定逻辑。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ── Mirror of TabBar.createNewTab ──────────────────────────────────
// TabBar 第 2-18 行：给出 index，返回一个全新的 Tab 状态对象。
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

// ── Mirror of App.handleTabAdd ─────────────────────────────────────
// App 第 243-247 行：新建 Tab 并激活。
function handleTabAdd(tabs) {
  const t = createNewTab(tabs.length)
  return { tabs: [...tabs, t], activeTabId: t.id }
}

// ── Mirror of App.handleTabClose ───────────────────────────────────
// App 第 249-256 行：关闭 Tab；若关的是 active，激活末尾；只剩 1 个时不关闭。
function handleTabClose(tabs, activeTabId, id) {
  if (tabs.length <= 1) return { tabs, activeTabId, closed: false }
  const next = tabs.filter(t => t.id !== id)
  let newActive = activeTabId
  if (id === activeTabId && next.length > 0) newActive = next[next.length - 1].id
  return { tabs: next, activeTabId: newActive, closed: true }
}

// ── Mirror of App.handleTabSelect（即 setActiveTabId）───────────────
function handleTabSelect(tabId) {
  return tabId
}

// ── 工具 ───────────────────────────────────────────────────────────
function makeTab(overrides = {}) {
  return {
    id: `tab-${Math.random().toString(36).slice(2, 9)}`,
    name: '转换 1',
    input: '',
    sourceFormat: 'json',
    targetFormat: 'yaml',
    sourceOptions: {},
    targetOptions: {},
    result: { success: false, output: '', elapsed: 0 },
    parsedData: null,
    isProcessing: false,
    isTypeEditorOpen: false,
    notice: null,
    ...overrides
  }
}

describe('TabBar.createNewTab', () => {
  test('返回对象包含全部必要字段', () => {
    const tab = createNewTab(0)
    const required = ['id', 'name', 'input', 'sourceFormat', 'targetFormat',
      'sourceOptions', 'targetOptions', 'result', 'parsedData', 'isProcessing',
      'isTypeEditorOpen', 'notice']
    for (const k of required) {
      assert.ok(k in tab, `缺少字段 ${k}`)
    }
  })

  test('name 为「转换 N+1」格式', () => {
    assert.equal(createNewTab(0).name, '转换 1')
    assert.equal(createNewTab(1).name, '转换 2')
    assert.equal(createNewTab(9).name, '转换 10')
  })

  test('默认 sourceFormat=json / targetFormat=yaml', () => {
    const tab = createNewTab(0)
    assert.equal(tab.sourceFormat, 'json')
    assert.equal(tab.targetFormat, 'yaml')
  })

  test('初始状态干净：无输入、无结果、无脏标记、无 notice', () => {
    const tab = createNewTab(0)
    assert.equal(tab.input, '')
    assert.equal(tab.result.success, false)
    assert.equal(tab.result.output, '')
    assert.equal(tab.parsedData, null)
    assert.equal(tab.isProcessing, false)
    assert.equal(tab.notice, null)
  })

  test('options 为空对象（引用独立）', () => {
    const a = createNewTab(0)
    const b = createNewTab(0)
    assert.notEqual(a.sourceOptions, b.sourceOptions, 'sourceOptions 应是独立引用')
    assert.notEqual(a.targetOptions, b.targetOptions, 'targetOptions 应是独立引用')
    assert.deepEqual(a.sourceOptions, {})
    assert.deepEqual(a.targetOptions, {})
  })

  test('每次调用 id 唯一（包含随机后缀）', () => {
    const ids = new Set()
    for (let i = 0; i < 50; i++) {
      ids.add(createNewTab(0).id)
    }
    assert.equal(ids.size, 50, '50 次调用应产生 50 个唯一 id')
  })

  test('id 以 tab- 开头', () => {
    assert.ok(createNewTab(0).id.startsWith('tab-'))
  })
})

describe('App.handleTabAdd', () => {
  test('新建 Tab 追加到末尾并激活', () => {
    const t0 = makeTab({ id: 'a' })
    const { tabs, activeTabId } = handleTabAdd([t0])
    assert.equal(tabs.length, 2)
    assert.equal(tabs[0].id, 'a')
    assert.notEqual(tabs[1].id, 'a')
    assert.equal(activeTabId, tabs[1].id, '新 Tab 应被激活')
  })

  test('新建 Tab 的 name 为「转换 N+1」', () => {
    const tabs = [makeTab({ id: 'a' }), makeTab({ id: 'b' })]
    const { tabs: next } = handleTabAdd(tabs)
    assert.equal(next[2].name, '转换 3')
  })

  test('空列表添加首个 Tab', () => {
    const { tabs, activeTabId } = handleTabAdd([])
    assert.equal(tabs.length, 1)
    assert.equal(activeTabId, tabs[0].id)
  })

  test('原 tabs 数组不被修改（不可变）', () => {
    const original = [makeTab({ id: 'a' })]
    const snapshot = JSON.stringify(original)
    handleTabAdd(original)
    assert.equal(JSON.stringify(original), snapshot, '原数组不应被修改')
  })
})

describe('App.handleTabClose', () => {
  test('关闭非 active Tab：active 不变', () => {
    const t0 = makeTab({ id: 'a' })
    const t1 = makeTab({ id: 'b' })
    const t2 = makeTab({ id: 'c' })
    const { tabs, activeTabId, closed } = handleTabClose([t0, t1, t2], 'a', 'b')
    assert.equal(closed, true)
    assert.equal(tabs.length, 2)
    assert.equal(tabs.map(t => t.id).join(','), 'a,c')
    assert.equal(activeTabId, 'a', 'active 应为 a 且不变')
  })

  test('关闭 active Tab：激活末尾 Tab', () => {
    const t0 = makeTab({ id: 'a' })
    const t1 = makeTab({ id: 'b' })
    const t2 = makeTab({ id: 'c' })
    const { tabs, activeTabId } = handleTabClose([t0, t1, t2], 'b', 'b')
    assert.equal(tabs.length, 2)
    assert.equal(activeTabId, 'c', '应激活末尾 Tab c')
  })

  test('关闭最后一个 active Tab：激活前一个', () => {
    const t0 = makeTab({ id: 'a' })
    const t1 = makeTab({ id: 'b' })
    const { tabs, activeTabId } = handleTabClose([t0, t1], 'b', 'b')
    assert.equal(tabs.length, 1)
    assert.equal(activeTabId, 'a')
  })

  test('只剩 1 个 Tab 时拒绝关闭', () => {
    const t0 = makeTab({ id: 'a' })
    const { tabs, activeTabId, closed } = handleTabClose([t0], 'a', 'a')
    assert.equal(closed, false)
    assert.equal(tabs.length, 1)
    assert.equal(activeTabId, 'a')
  })

  test('关闭不存在的 Tab：静默返回（过滤后不变）', () => {
    const t0 = makeTab({ id: 'a' })
    const t1 = makeTab({ id: 'b' })
    const { tabs, closed } = handleTabClose([t0, t1], 'a', 'missing')
    assert.equal(closed, true)
    assert.equal(tabs.length, 2, '过滤无变化')
  })

  test('原 tabs 数组不被修改（不可变）', () => {
    const t0 = makeTab({ id: 'a' })
    const t1 = makeTab({ id: 'b' })
    const original = [t0, t1]
    const snapshot = JSON.stringify(original)
    handleTabClose(original, 'a', 'b')
    assert.equal(JSON.stringify(original), snapshot)
  })
})

describe('App.handleTabSelect', () => {
  test('返回被点击的 tabId', () => {
    assert.equal(handleTabSelect('tab-x'), 'tab-x')
  })

  test('切换 active 不影响 tabs 数组', () => {
    // 契约：onTabSelect 仅改变 activeTabId，不增删 Tab
    const tabs = [makeTab({ id: 'a' }), makeTab({ id: 'b' })]
    const newActive = handleTabSelect('b')
    assert.equal(newActive, 'b')
    assert.equal(tabs.length, 2)
  })
})

describe('TabBar 渲染契约（条件判定）', () => {
  test('tabs.length > 1 时显示关闭按钮', () => {
    // TabBar 第 31 行：{tabs.length > 1 && (<button className='fc-tab-close'>×</button>)}
    function showCloseButton(tabsLength) {
      return tabsLength > 1
    }
    assert.equal(showCloseButton(2), true)
    assert.equal(showCloseButton(1), false)
    assert.equal(showCloseButton(0), false)
  })

  test('active Tab 应用 active 类名', () => {
    // TabBar 第 26 行：className={`fc-tab${activeTabId === tab.id ? ' active' : ''}`}
    function tabClassName(tabId, activeTabId) {
      return `fc-tab${activeTabId === tabId ? ' active' : ''}`
    }
    assert.equal(tabClassName('a', 'a'), 'fc-tab active')
    assert.equal(tabClassName('a', 'b'), 'fc-tab')
  })

  test('关闭按钮点击触发 onTabClose 而不触发 onTabSelect', () => {
    // TabBar 第 35 行：onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
    // 契约：stopPropagation 阻止冒泡 → 不应调用 onTabSelect
    let selected = null
    let closed = null

    // 模拟：先冒泡到 tab 的 onClick（onTabSelect），但 stopPropagation 会阻止
    function simulateCloseClick(tabId, onTabSelect, onTabClose) {
      let propagate = true
      const event = { stopPropagation: () => { propagate = false } }
      // 内部按钮 onClick
      event.stopPropagation()
      onTabClose(tabId)
      // 外层 tab onClick —— 因 stopPropagation 不再执行
      if (propagate) onTabSelect(tabId)
    }

    simulateCloseClick('a', id => { selected = id }, id => { closed = id })
    assert.equal(closed, 'a')
    assert.equal(selected, null, 'stopPropagation 应阻止 onTabSelect')
  })
})
