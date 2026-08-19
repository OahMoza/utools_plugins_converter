// useEditableTable.js — 表格编辑状态机 Hook
import { useReducer, useCallback } from 'react'

/** @typedef {Record<string, any>} RowData */
/** @typedef {{ row: number; col: string }} CellCoord */

/**
 * @typedef {Object} EditableTableState
 * @property {RowData[]} displayData
 * @property {string[]} columns
 * @property {boolean} isDirty
 * @property {CellCoord|null} editingCell
 * @property {string} editValue
 */

/**
 * @param {RowData[]} data
 * @param {string[]} columns
 * @returns {EditableTableState}
 */
export function createInitialState(data, columns) {
  return {
    displayData: data || [],
    columns: Array.isArray(columns) ? [...columns] : [],
    isDirty: false,
    editingCell: null,
    editValue: ''
  }
}

/**
 * @param {EditableTableState} state
 * @returns {string} 单元格值的字符串表示，用于编辑框显示
 */
function cellValueToEditString(state, row, col) {
  const value = state.displayData[row]?.[col]
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * @param {any} value
 * @returns {any} 根据原始列值类型推断，将编辑后的字符串转换回原始类型
 */
function inferTypeAndConvert(originalValue, editString) {
  if (originalValue === null || originalValue === undefined) return editString
  if (typeof originalValue === 'number') {
    const n = Number(editString)
    return isNaN(n) ? editString : n
  }
  if (typeof originalValue === 'boolean') {
    if (editString === 'true') return true
    if (editString === 'false') return false
    return editString
  }
  if (typeof originalValue === 'object') {
    try {
      return JSON.parse(editString)
    } catch {
      return editString
    }
  }
  return editString
}

/**
 * @param {EditableTableState} state
 * @param {any} action
 * @returns {EditableTableState}
 */
export function editableTableReducer(state, action) {
  switch (action.type) {
    case 'START_EDIT': {
      return {
        ...state,
        editingCell: { row: action.row, col: action.col },
        editValue: cellValueToEditString(state, action.row, action.col)
      }
    }
    case 'SET_EDIT_VALUE': {
      return { ...state, editValue: action.value }
    }
    case 'COMMIT_EDIT': {
      if (!state.editingCell) return state
      const { row, col } = state.editingCell
      const newData = state.displayData.map((r, i) => {
        if (i !== row) return r
        const originalValue = r[col]
        const converted = inferTypeAndConvert(originalValue, state.editValue)
        return { ...r, [col]: converted }
      })
      return {
        ...state,
        displayData: newData,
        isDirty: true,
        editingCell: null,
        editValue: ''
      }
    }
    case 'CANCEL_EDIT': {
      return { ...state, editingCell: null, editValue: '' }
    }
    case 'RENAME_COLUMN': {
      const { oldName, newName } = action
      if (oldName === newName) return state
      if (state.columns.includes(newName)) return state // reject duplicate
      const newColumns = state.columns.map(c => c === oldName ? newName : c)
      const newData = state.displayData.map(row => {
        if (!(oldName in row)) return row
        const { [oldName]: value, ...rest } = row
        return { ...rest, [newName]: value }
      })
      return { ...state, columns: newColumns, displayData: newData, isDirty: true }
    }
    case 'ADD_ROW': {
      const newRow = {}
      for (const col of state.columns) {
        const sample = state.displayData[0]?.[col]
        if (typeof sample === 'number') newRow[col] = 0
        else if (typeof sample === 'boolean') newRow[col] = false
        else newRow[col] = ''
      }
      return {
        ...state,
        displayData: [...state.displayData, newRow],
        isDirty: true
      }
    }
    case 'REMOVE_ROW': {
      if (action.index < 0 || action.index >= state.displayData.length) return state
      const newData = state.displayData.filter((_, i) => i !== action.index)
      return { ...state, displayData: newData, isDirty: true }
    }
    case 'RESET': {
      return createInitialState(action.data, action.columns)
    }
    default:
      return state
  }
}

/**
 * @param {RowData[]} initialData
 * @param {string[]} columns
 */
export function useEditableTable(initialData, columns) {
  const [state, dispatch] = useReducer(
    editableTableReducer,
    { data: initialData, columns },
    ({ data, cols }) => createInitialState(data, cols)
  )

  const startEdit = useCallback((row, col) => {
    dispatch({ type: 'START_EDIT', row, col })
  }, [])

  const setEditValue = useCallback((value) => {
    dispatch({ type: 'SET_EDIT_VALUE', value })
  }, [])

  const commitEdit = useCallback(() => {
    dispatch({ type: 'COMMIT_EDIT' })
  }, [])

  const cancelEdit = useCallback(() => {
    dispatch({ type: 'CANCEL_EDIT' })
  }, [])

  const renameColumn = useCallback((oldName, newName) => {
    dispatch({ type: 'RENAME_COLUMN', oldName, newName })
  }, [])

  const addRow = useCallback(() => {
    dispatch({ type: 'ADD_ROW' })
  }, [])

  const removeRow = useCallback((index) => {
    dispatch({ type: 'REMOVE_ROW', index })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET', data: initialData, columns })
  }, [initialData, columns])

  return {
    displayData: state.displayData,
    columns: state.columns,
    isDirty: state.isDirty,
    editingCell: state.editingCell,
    editValue: state.editValue,
    startEdit,
    setEditValue,
    commitEdit,
    cancelEdit,
    renameColumn,
    addRow,
    removeRow,
    reset
  }
}

export default useEditableTable
