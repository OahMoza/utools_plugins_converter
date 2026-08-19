// useConversionHistory —— 格式转换历史，持久化到 utools.dbStorage（localStorage 兜底）
// 复用 plugins-json 的 useExpressionHistory 模式
import { useState, useEffect, useCallback } from 'react'

const KEY = 'format-converter:history'
const MAX = 30

/**
 * 纯函数：把一条新记录添加到历史列表。
 *  - 按 (sourceFormat, targetFormat) 去重（移除旧的同路径记录）
 *  - 新记录前置插入
 *  - 截断到 max 条（默认 MAX=30）
 * @param {Array} prev 当前历史
 * @param {Object} entry 新记录 { id, sourceFormat, targetFormat, rowCount, createdAt }
 * @param {number} max 上限
 * @returns {Array} 新历史数组（不可变）
 */
export function addRecordToList(prev, entry, max = MAX) {
  const filtered = prev.filter(
    e => !(e.sourceFormat === entry.sourceFormat && e.targetFormat === entry.targetFormat)
  )
  return [entry, ...filtered].slice(0, max)
}

function load(fallback) {
  try {
    if (typeof window !== 'undefined' && window.utools?.dbStorage) {
      const v = window.utools.dbStorage.getItem(KEY)
      return v ? JSON.parse(v) : fallback
    }
    const v = localStorage.getItem(KEY)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

function save(value) {
  try {
    const json = JSON.stringify(value)
    if (typeof window !== 'undefined' && window.utools?.dbStorage) {
      window.utools.dbStorage.setItem(KEY, json)
    }
    localStorage.setItem(KEY, json)
  } catch {}
}

export default function useConversionHistory() {
  const [history, setHistory] = useState(() => load([]))

  useEffect(() => { save(history) }, [history])

  const addRecord = useCallback((sourceFormat, targetFormat, rowCount) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceFormat,
      targetFormat,
      rowCount,
      createdAt: Date.now()
    }
    setHistory(prev => addRecordToList(prev, entry))
  }, [])

  const clearHistory = useCallback(() => setHistory([]), [])

  return { history, addRecord, clearHistory }
}
