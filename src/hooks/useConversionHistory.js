// useConversionHistory —— 格式转换历史，持久化到 utools.dbStorage（localStorage 兜底）
// 复用 plugins-json 的 useExpressionHistory 模式
import { useState, useEffect, useCallback } from 'react'

const KEY = 'format-converter:history'
const MAX = 30

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
    setHistory(prev => {
      const filtered = prev.filter(e => !(e.sourceFormat === sourceFormat && e.targetFormat === targetFormat))
      return [entry, ...filtered].slice(0, MAX)
    })
  }, [])

  const clearHistory = useCallback(() => setHistory([]), [])

  return { history, addRecord, clearHistory }
}
