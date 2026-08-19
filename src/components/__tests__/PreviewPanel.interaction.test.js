// PreviewPanel.interaction.test.js —— PreviewPanel 用户交互逻辑测试
//
// 已有 PreviewPanel.test.js 覆盖 onDataChange 回调与 hasData 判定。本文件补充
//「用户操作 → UI 变化 / 回调」的契约测试：
//   - 单元格编辑流程（startEdit → 输入 → commit/cancel）
//   - 列重命名（含 prompt 取消 / 空名 / 重名 边界）
//   - 增删行对行号与数据的影响
//   - 键盘交互（Enter 提交 / Escape 取消）
//   - 搜索过滤、复制到 Excel 的 TSV 转义
//   - 脏标记与重置
// 组件依赖 DOM，这里镜像其内部纯逻辑与条件判定。
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  editableTableReducer,
  createInitialState
} from '../../hooks/useEditableTable.js'

const sampleData = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: '3', name: 'Carol', age: 28 }
]
const sampleColumns = ['id', 'name', 'age']

// ── Mirror of PreviewPanel 列推导 ──────────────────────────────────
function deriveColumns(data) {
  return Object.keys(data?.[0] || {})
}

// ── Mirror of PreviewPanel 单元格编辑流程 ─────────────────────────
// 组件内：onClick={startEdit(i,col)} → 输入框 → onChange={setEditValue}
//         → onBlur={commitEdit} / onKeyDown(Enter→commit, Escape→cancel)
function editCellFlow(state, row, col, newValue) {
  const s1 = editableTableReducer(state, { type: 'START_EDIT', row, col })
  const s2 = editableTableReducer(s1, { type: 'SET_EDIT_VALUE', value: newValue })
  return editableTableReducer(s2, { type: 'COMMIT_EDIT' })
}

// ── Mirror of PreviewPanel 列重命名（含 prompt 边界）────────────────
// 组件第 245 行：const newName = prompt('重命名列', col)
//               if (newName && newName.trim()) renameColumn(col, newName.trim())
function renameColumnWithPrompt(state, oldName, promptResult) {
  // prompt 返回 null（取消）、空字符串、或有效名
  if (!promptResult) return { state, renamed: false, reason: 'cancelled' }
  const trimmed = promptResult.trim()
  if (!trimmed) return { state, renamed: false, reason: 'empty' }
  return {
    state: editableTableReducer(state, { type: 'RENAME_COLUMN', oldName, newName: trimmed }),
    renamed: true
  }
}

// ── Mirror of PreviewPanel 行操作 ─────────────────────────────────
function addRowFlow(state) {
  return editableTableReducer(state, { type: 'ADD_ROW' })
}
function removeRowFlow(state, index) {
  return editableTableReducer(state, { type: 'REMOVE_ROW', index })
}

// ── Mirror of PreviewPanel.handleEditKeyDown ───────────────────────
// 组件第 94-102 行：Enter → commitEdit；Escape → cancelEdit
function handleEditKeyDown(state, key, { commitEdit, cancelEdit }) {
  if (key === 'Enter') {
    return { state: commitEdit(state), action: 'commit' }
  } else if (key === 'Escape') {
    return { state: cancelEdit(state), action: 'cancel' }
  }
  return { state, action: 'none' }
}
const commitState = (s) => editableTableReducer(s, { type: 'COMMIT_EDIT' })
const cancelState = (s) => editableTableReducer(s, { type: 'CANCEL_EDIT' })

// ── Mirror of PreviewPanel 搜索过滤 ────────────────────────────────
// 组件第 48-64 行
function getFilteredRows(displayData, columns, searchKeyword, searchAllColumns, searchColumn) {
  if (!displayData || displayData.length === 0) return []
  if (!searchKeyword.trim()) return displayData.slice(0, 500)
  const filtered = displayData.filter(row => {
    if (searchAllColumns) {
      return columns.some(col => {
        const str = row[col] === null || row[col] === undefined ? 'NULL' : String(row[col])
        return str.toLowerCase().includes(searchKeyword.toLowerCase())
      })
    } else if (searchColumn) {
      const str = row[searchColumn] === null || row[searchColumn] === undefined ? 'NULL' : String(row[searchColumn])
      return str.toLowerCase().includes(searchKeyword.toLowerCase())
    }
    return true
  })
  return filtered.slice(0, 500)
}

// ── Mirror of PreviewPanel.formatCellValue ─────────────────────────
// 组件第 84-92 行
function formatCellValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') {
    const str = JSON.stringify(value, null, 2)
    return str.length > 100 ? str.slice(0, 100) + '...' : str
  }
  const str = String(value)
  return str.length > 100 ? str.slice(0, 100) + '...' : str
}

// ── Mirror of PreviewPanel.escapeTsv ───────────────────────────────
// 组件第 66 行
function escapeTsv(val) {
  return String(val).replace(/\t/g, ' ').replace(/\r?\n/g, ' ').replace(/\r/g, ' ')
}

// ── Mirror of PreviewPanel.handleCopyToExcel ───────────────────────
// 组件第 68-82 行：TSV = header + rows，用 \t 分隔、\r\n 换行
function buildTsv(columns, rows) {
  const header = columns.map(escapeTsv).join('\t')
  const body = rows.map(row =>
    columns.map(col => escapeTsv(formatCellValue(row[col]))).join('\t')
  )
  return [header, ...body].join('\r\n')
}

// ── 工具 ───────────────────────────────────────────────────────────
function makeState(overrides = {}) {
  return {
    displayData: sampleData,
    columns: sampleColumns,
    isDirty: false,
    editingCell: null,
    editValue: '',
    ...overrides
  }
}

describe('PreviewPanel 单元格编辑流程', () => {
  test('startEdit → 输入 → commit：数据更新 + isDirty=true + 编辑态清除', () => {
    const s0 = makeState()
    const s1 = editableTableReducer(s0, { type: 'START_EDIT', row: 0, col: 'name' })
    assert.deepEqual(s1.editingCell, { row: 0, col: 'name' })
    assert.equal(s1.editValue, 'Alice')

    const s2 = editableTableReducer(s1, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    assert.equal(s2.editValue, 'Alex')

    const s3 = editableTableReducer(s2, { type: 'COMMIT_EDIT' })
    assert.equal(s3.displayData[0].name, 'Alex')
    assert.equal(s3.isDirty, true)
    assert.equal(s3.editingCell, null)
    assert.equal(s3.editValue, '')
  })

  test('editCellFlow 快捷函数：一次调用完成编辑', () => {
    const s = editCellFlow(makeState(), 1, 'name', 'Robert')
    assert.equal(s.displayData[1].name, 'Robert')
    assert.equal(s.isDirty, true)
  })

  test('编辑不影响其它行', () => {
    const s = editCellFlow(makeState(), 0, 'name', 'Alex')
    assert.equal(s.displayData[1].name, 'Bob')
    assert.equal(s.displayData[2].name, 'Carol')
  })

  test('cancel 恢复编辑态且不修改数据', () => {
    const s0 = makeState()
    const s1 = editableTableReducer(s0, { type: 'START_EDIT', row: 0, col: 'name' })
    const s2 = editableTableReducer(s1, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    const s3 = editableTableReducer(s2, { type: 'CANCEL_EDIT' })
    assert.equal(s3.displayData[0].name, 'Alice')
    assert.equal(s3.isDirty, false)
    assert.equal(s3.editingCell, null)
  })

  test('类型推断：数字字符串 → 数字', () => {
    const s = editCellFlow(makeState(), 0, 'age', '42')
    assert.equal(s.displayData[0].age, 42)
    assert.equal(typeof s.displayData[0].age, 'number')
  })

  test('类型推断：数字列输入非数字 → 保留字符串', () => {
    const s = editCellFlow(makeState(), 0, 'age', 'not-a-number')
    assert.equal(s.displayData[0].age, 'not-a-number')
  })

  test('类型推断：字符串列保持字符串', () => {
    const s = editCellFlow(makeState(), 0, 'name', '123')
    assert.equal(s.displayData[0].name, '123')
    assert.equal(typeof s.displayData[0].name, 'string')
  })

  test('编辑 null 单元格：初始 editValue 为空字符串', () => {
    const data = [{ id: 1, name: null }]
    const s0 = createInitialState(data, ['id', 'name'])
    const s1 = editableTableReducer(s0, { type: 'START_EDIT', row: 0, col: 'name' })
    assert.equal(s1.editValue, '')
    const s2 = editableTableReducer(s1, { type: 'SET_EDIT_VALUE', value: 'filled' })
    const s3 = editableTableReducer(s2, { type: 'COMMIT_EDIT' })
    assert.equal(s3.displayData[0].name, 'filled')
  })
})

describe('PreviewPanel 列重命名（含 prompt 边界）', () => {
  test('正常重命名', () => {
    const { state, renamed } = renameColumnWithPrompt(makeState(), 'name', 'fullName')
    assert.equal(renamed, true)
    assert.ok('fullName' in state.displayData[0])
    assert.ok(!('name' in state.displayData[0]))
    assert.equal(state.columns.includes('fullName'), true)
    assert.equal(state.isDirty, true)
  })

  test('prompt 取消（返回 null）→ 不重命名', () => {
    const { state, renamed, reason } = renameColumnWithPrompt(makeState(), 'name', null)
    assert.equal(renamed, false)
    assert.equal(reason, 'cancelled')
    assert.deepEqual(state.columns, sampleColumns)
  })

  test('prompt 返回空字符串 → 不重命名', () => {
    const { renamed, reason } = renameColumnWithPrompt(makeState(), 'name', '   ')
    assert.equal(renamed, false)
    assert.equal(reason, 'empty')
  })

  test('重命名为已有列名 → reducer 拒绝（去重）', () => {
    // prompt 返回 'age'（已存在），reducer 会拒绝
    const s0 = makeState()
    const s1 = editableTableReducer(s0, { type: 'RENAME_COLUMN', oldName: 'name', newName: 'age' })
    assert.deepEqual(s1.columns, sampleColumns, '重名时应保持不变')
  })

  test('重命名保留全部行的值', () => {
    const { state } = renameColumnWithPrompt(makeState(), 'name', 'fullName')
    assert.equal(state.displayData[0].fullName, 'Alice')
    assert.equal(state.displayData[1].fullName, 'Bob')
    assert.equal(state.displayData[2].fullName, 'Carol')
  })

  test('重命名对不存在的列 → 数据不变（reducer 行为）', () => {
    const s0 = makeState()
    const s1 = editableTableReducer(s0, { type: 'RENAME_COLUMN', oldName: 'missing', newName: 'x' })
    assert.deepEqual(s1.columns, sampleColumns)
  })
})

describe('PreviewPanel 行操作', () => {
  test('addRow：追加一行，字段类型取样本', () => {
    const s = addRowFlow(makeState())
    assert.equal(s.displayData.length, 4)
    const newRow = s.displayData[3]
    assert.equal(newRow.name, '')
    assert.equal(newRow.age, 0)
    assert.equal(newRow.id, 0, '数字列默认 0')
    assert.equal(s.isDirty, true)
  })

  test('addRow：空数据集也能添加（无样本时默认空字符串）', () => {
    const s0 = createInitialState([], [])
    const s1 = addRowFlow(s0)
    assert.equal(s1.displayData.length, 1)
  })

  test('removeRow：删除指定行', () => {
    const s = removeRowFlow(makeState(), 1)
    assert.equal(s.displayData.length, 2)
    assert.equal(s.displayData[0].name, 'Alice')
    assert.equal(s.displayData[1].name, 'Carol')
    assert.equal(s.isDirty, true)
  })

  test('removeRow：删除首行', () => {
    const s = removeRowFlow(makeState(), 0)
    assert.equal(s.displayData[0].name, 'Bob')
  })

  test('removeRow：越界索引安全', () => {
    const s0 = makeState()
    const s1 = removeRowFlow(s0, 99)
    assert.equal(s1.displayData.length, 3, '越界不删除')
    const s2 = removeRowFlow(s0, -1)
    assert.equal(s2.displayData.length, 3, '负索引不删除')
  })

  test('行号与数据索引一致（行号 = index + 1）', () => {
    // 组件第 264 行：{i + 1}
    const s = makeState()
    const rowNumbers = s.displayData.map((_, i) => i + 1)
    assert.deepEqual(rowNumbers, [1, 2, 3])
  })
})

describe('PreviewPanel 键盘交互', () => {
  test('Enter → 提交编辑', () => {
    const s0 = makeState()
    const s1 = editableTableReducer(s0, { type: 'START_EDIT', row: 0, col: 'name' })
    const s2 = editableTableReducer(s1, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    const { state, action } = handleEditKeyDown(s2, 'Enter', { commitEdit: commitState, cancelEdit: cancelState })
    assert.equal(action, 'commit')
    assert.equal(state.displayData[0].name, 'Alex')
    assert.equal(state.editingCell, null)
  })

  test('Escape → 取消编辑', () => {
    const s0 = makeState()
    const s1 = editableTableReducer(s0, { type: 'START_EDIT', row: 0, col: 'name' })
    const s2 = editableTableReducer(s1, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    const { state, action } = handleEditKeyDown(s2, 'Escape', { commitEdit: commitState, cancelEdit: cancelState })
    assert.equal(action, 'cancel')
    assert.equal(state.displayData[0].name, 'Alice')
    assert.equal(state.editingCell, null)
  })

  test('其它键 → 无操作', () => {
    const s0 = makeState()
    const s1 = editableTableReducer(s0, { type: 'START_EDIT', row: 0, col: 'name' })
    const s2 = editableTableReducer(s1, { type: 'SET_EDIT_VALUE', value: 'Alex' })
    const { state, action } = handleEditKeyDown(s2, 'Tab', { commitEdit: commitState, cancelEdit: cancelState })
    assert.equal(action, 'none')
    assert.deepEqual(state.editingCell, { row: 0, col: 'name' }, '编辑态应保持')
  })
})

describe('PreviewPanel 搜索过滤', () => {
  test('空关键词返回全部（上限 500）', () => {
    const rows = getFilteredRows(sampleData, sampleColumns, '', true, '')
    assert.equal(rows.length, 3)
  })

  test('全字段搜索：匹配任一列即命中', () => {
    const rows = getFilteredRows(sampleData, sampleColumns, 'Alice', true, '')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].name, 'Alice')
  })

  test('搜索数字：字符串化后匹配', () => {
    const rows = getFilteredRows(sampleData, sampleColumns, '30', true, '')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].name, 'Alice')
  })

  test('指定列搜索：仅匹配该列', () => {
    const rows = getFilteredRows(sampleData, sampleColumns, 'Alice', false, 'name')
    assert.equal(rows.length, 1)
    const rowsAge = getFilteredRows(sampleData, sampleColumns, 'Alice', false, 'age')
    assert.equal(rowsAge.length, 0, '按 age 列搜 Alice 应无结果')
  })

  test('大小写不敏感', () => {
    const rows = getFilteredRows(sampleData, sampleColumns, 'alice', true, '')
    assert.equal(rows.length, 1)
  })

  test('NULL 值搜索：null/undefined 显示为 NULL', () => {
    const data = [{ id: 1, name: null }, { id: 2, name: 'Bob' }]
    const rows = getFilteredRows(data, ['id', 'name'], 'NULL', false, 'name')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 1)
  })

  test('无匹配返回空数组', () => {
    const rows = getFilteredRows(sampleData, sampleColumns, 'zzz', true, '')
    assert.equal(rows.length, 0)
  })

  test('上限 500 条', () => {
    const big = Array.from({ length: 600 }, (_, i) => ({ id: i, name: `n${i}` }))
    const rows = getFilteredRows(big, ['id', 'name'], '', true, '')
    assert.equal(rows.length, 500)
  })
})

describe('PreviewPanel formatCellValue 与 TSV 转义', () => {
  test('null/undefined → NULL', () => {
    assert.equal(formatCellValue(null), 'NULL')
    assert.equal(formatCellValue(undefined), 'NULL')
  })

  test('对象 → JSON（超 100 截断）', () => {
    const big = { data: 'x'.repeat(200) }
    const formatted = formatCellValue(big)
    assert.match(formatted, /\.\.\.$/, '超长应截断并加 ...')
    assert.ok(formatted.length <= 103) // 100 + '...'
  })

  test('短字符串原样', () => {
    assert.equal(formatCellValue('hello'), 'hello')
  })

  test('长字符串截断到 100', () => {
    const long = 'a'.repeat(150)
    const formatted = formatCellValue(long)
    assert.equal(formatted.length, 103)
    assert.match(formatted, /\.\.\.$/)
  })

  test('escapeTsv：制表符、换行替换为空格', () => {
    assert.equal(escapeTsv('a\tb'), 'a b')
    assert.equal(escapeTsv('a\nb'), 'a b')
    assert.equal(escapeTsv('a\r\nb'), 'a b')
    assert.equal(escapeTsv('a\rb'), 'a b')
  })

  test('escapeTsv：普通字符串不变', () => {
    assert.equal(escapeTsv('hello'), 'hello')
  })
})

describe('PreviewPanel 复制到 Excel（TSV 生成）', () => {
  test('单列单行', () => {
    const tsv = buildTsv(['name'], [{ name: 'Alice' }])
    assert.equal(tsv, 'name\r\nAlice')
  })

  test('多列多行', () => {
    const tsv = buildTsv(['id', 'name'], [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }])
    assert.equal(tsv, 'id\tname\r\n1\tAlice\r\n2\tBob')
  })

  test('含制表符/换行的字段被转义', () => {
    const tsv = buildTsv(['text'], [{ text: 'a\tb\nc' }])
    assert.equal(tsv, 'text\r\na b c')
  })

  test('NULL 值显示为 NULL', () => {
    const tsv = buildTsv(['name'], [{ name: null }])
    assert.equal(tsv, 'name\r\nNULL')
  })

  test('空数据集仅 header', () => {
    const tsv = buildTsv(['a', 'b'], [])
    assert.equal(tsv, 'a\tb')
  })

  test('对象字段格式化后截断', () => {
    const tsv = buildTsv(['meta'], [{ meta: { data: 'x'.repeat(200) } }])
    assert.match(tsv, /meta\r\n.*\.\.\.$/)
  })
})

describe('PreviewPanel 脏标记与重置', () => {
  test('初始 isDirty=false', () => {
    assert.equal(makeState().isDirty, false)
  })

  test('任意修改操作后 isDirty=true', () => {
    const s0 = makeState()
    assert.equal(editCellFlow(s0, 0, 'name', 'x').isDirty, true)
    assert.equal(addRowFlow(s0).isDirty, true)
    assert.equal(removeRowFlow(s0, 0).isDirty, true)
    assert.equal(editableTableReducer(s0, { type: 'RENAME_COLUMN', oldName: 'name', newName: 'x' }).isDirty, true)
  })

  test('reset 恢复原始数据并清除脏标记', () => {
    let s = editCellFlow(makeState(), 0, 'name', 'Alex')
    s = editableTableReducer(s, { type: 'RESET', data: sampleData, columns: sampleColumns })
    assert.equal(s.isDirty, false)
    assert.deepEqual(s.displayData, sampleData)
  })

  test('reset 使用原始引用（不保留编辑）', () => {
    let s = editCellFlow(makeState(), 0, 'name', 'Alex')
    s = editableTableReducer(s, { type: 'RESET', data: sampleData, columns: sampleColumns })
    assert.equal(s.displayData[0].name, 'Alice')
  })
})

describe('PreviewPanel 渲染条件契约', () => {
  test('hasData：空/undefined → false', () => {
    function hasData(d) { return !!(d && d.length > 0) }
    assert.equal(hasData(null), false)
    assert.equal(hasData([]), false)
    assert.equal(hasData(undefined), false)
  })

  test('hasData：有数据 → true', () => {
    function hasData(d) { return !!(d && d.length > 0) }
    assert.equal(hasData(sampleData), true)
  })

  test('isDirty → 渲染「已编辑」提示条', () => {
    // 组件第 112 行：{isDirty && (<div>已编辑</div>)}
    const s = editCellFlow(makeState(), 0, 'name', 'x')
    assert.equal(s.isDirty, true)
  })

  test('orientation 切换：horizontal ↔ vertical', () => {
    // 组件第 199 行：setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')
    function toggleOrientation(prev) {
      return prev === 'horizontal' ? 'vertical' : 'horizontal'
    }
    assert.equal(toggleOrientation('horizontal'), 'vertical')
    assert.equal(toggleOrientation('vertical'), 'horizontal')
  })

  test('「添加行」按钮在有数据且 columns>0 时渲染', () => {
    // 组件第 411 行：{hasData && columns.length > 0 && (<Button>添加行</Button>)}
    function showAddRow(displayData, columns) {
      return !!(displayData && displayData.length > 0) && columns.length > 0
    }
    assert.equal(showAddRow(sampleData, sampleColumns), true)
    assert.equal(showAddRow([], sampleColumns), false)
    assert.equal(showAddRow(sampleData, []), false)
  })

  test('超 500 条时显示提示文案', () => {
    // 组件第 416 行：{displayData.length > 500 && (<span>仅显示前 500 条</span>)}
    function showTruncationHint(len) {
      return len > 500
    }
    assert.equal(showTruncationHint(501), true)
    assert.equal(showTruncationHint(500), false)
    assert.equal(showTruncationHint(100), false)
  })
})
