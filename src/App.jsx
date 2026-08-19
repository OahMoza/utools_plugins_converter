import { useState, useEffect, useRef, useCallback } from 'react'
import { IconArrowRight, IconCopy, IconDownload, IconFileUp, IconCheck, IconAlertCircle, IconFileSpreadsheet, IconTable, IconRotateCw, IconSettings, IconX } from './Icons.jsx'
import { Toolbar } from '@ztools/ui-kit/Card'
import { readXlsxFile, parseInput, stringifyOutput, downloadXlsx, autoDetectFormat } from './converters'
import { inferHiveType, HIVE_TYPE_OPTIONS } from './converters/hivesql'
import { inferMySqlType, MYSQL_TYPE_OPTIONS } from './converters/mysql'
import TabBar, { createNewTab } from './components/TabBar'
import useConversionHistory from './hooks/useConversionHistory'
import FormatSelector, { FORMATS, FORMAT_LABELS } from './components/FormatSelector'
import CodeEditorArea from './components/CodeEditorArea'
import InputPanel from './components/InputPanel'
import OutputPanel from './components/OutputPanel'
import StatusBar from './components/StatusBar'
import PreviewPanel from './components/PreviewPanel'
import OptionsPanel from './components/OptionsPanel'
import ColumnTypePanel from './components/ColumnTypePanel'

export default function App () {
  const [tabs, setTabs] = useState(() => [createNewTab(0)])
  const [activeTabId, setActiveTabId] = useState(tabs[0].id)
  const noticeTimerRef = useRef(null)
  const convertTimerRef = useRef(null)

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  const { addRecord } = useConversionHistory()

  const updateTab = useCallback((id, updates) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])

  const showNotice = useCallback((message, type = 'error') => {
    const tabId = activeTabId
    updateTab(tabId, { notice: { message, type } })
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => {
      updateTab(tabId, { notice: null })
    }, 3000)
  }, [activeTabId, updateTab])

  // 把格式转换能力暴露给 preload 注册的 MCP 工具（convert_format）
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.services = window.services || {}
    window.services.__convert = (input, sourceFormat, targetFormat, options = {}) => {
      try {
        const parsed = parseInput(input, sourceFormat, options)
        let jsonArray
        let isWrapper = false
        if (
          sourceFormat === 'sparksql' &&
          parsed && typeof parsed === 'object' &&
          'rows' in parsed && 'tableName' in parsed
        ) {
          jsonArray = parsed.rows
          isWrapper = true
        } else if (!parsed || !Array.isArray(parsed) || (parsed.length > 0 && typeof parsed[0] !== 'object')) {
          return { error: '输入必须是 JSON 数组格式' }
        } else {
          jsonArray = parsed
        }
        if (isWrapper && targetFormat === 'json') {
          return { success: true, output: JSON.stringify(parsed, null, 2) }
        }
        const output = stringifyOutput(jsonArray, targetFormat, options)
        return { success: true, output: typeof output === 'string' ? output : '' }
      } catch (e) {
        return { error: e.message || '转换失败' }
      }
    }
  }, [])

  // 进入插件：支持「文本选中」与「文件匹配」两种入口，均新建 Tab 打开
  useEffect(() => {
    window.utools?.onPluginEnter?.((act) => {
      const isText = act?.type === 'over' && act.payload
      const isFile = act?.type === 'files' && act.payload?.[0]?.path
      if (!isText && !isFile) return

      const newTab = createNewTab(tabs.length)
      if (isText) {
        newTab.input = String(act.payload)
        newTab.name = '选中内容'
      } else {
        try {
          newTab.input = window.services.readFile(act.payload[0].path)
          newTab.name = act.payload[0].name || '文件'
        } catch (e) {
          newTab.input = '// 读文件失败: ' + e.message
          newTab.name = '文件'
        }
      }
      setTabs(prev => [...prev, newTab])
      setActiveTabId(newTab.id)
    })
  }, [tabs.length])

  const handleDownload = useCallback(() => {
    const { input, sourceFormat, sourceOptions, targetOptions } = activeTab
    try {
      const jsonData = parseInput(input, sourceFormat, sourceOptions)
      if (jsonData && Array.isArray(jsonData)) {
        downloadXlsx(jsonData, 'output.xlsx', targetOptions)
        showNotice('已生成 output.xlsx', 'success')
      } else {
        showNotice('需要先输入有效的 JSON 数组数据')
      }
    } catch {
      showNotice('需要先输入有效的 JSON 数组数据')
    }
  }, [activeTab, showNotice])

  // 防抖转换：源 → JSON → 目标
  useEffect(() => {
    if (convertTimerRef.current) clearTimeout(convertTimerRef.current)
    convertTimerRef.current = setTimeout(() => {
      const { input, sourceFormat, sourceOptions, targetFormat, targetOptions } = activeTab
      const startTime = performance.now()
      updateTab(activeTabId, { isProcessing: true })

      try {
        let parsed = null
        let res = { success: false, output: '', elapsed: 0 }
        let data = null

        if (!input.trim()) {
          res = { success: false, output: '', elapsed: 0 }
          data = null
        } else {
          parsed = parseInput(input, sourceFormat, sourceOptions)
          let jsonArray
          let isWrapper = false

          if (
            sourceFormat === 'sparksql' &&
            parsed && typeof parsed === 'object' &&
            'rows' in parsed && 'tableName' in parsed
          ) {
            const wrapper = parsed
            jsonArray = wrapper.rows
            isWrapper = true
            data = jsonArray
          } else if (!parsed || !Array.isArray(parsed) || (parsed.length > 0 && typeof parsed[0] !== 'object')) {
            throw new Error('输入必须是 JSON 数组格式')
          } else {
            jsonArray = parsed
            data = jsonArray
          }

          let output
          if (isWrapper && targetFormat === 'json') {
            output = JSON.stringify(parsed, null, 2)
          } else {
            output = stringifyOutput(jsonArray, targetFormat, targetOptions)
          }

          const elapsed = Math.round(performance.now() - startTime)
          const isBinary = output instanceof ArrayBuffer
          res = {
            success: true,
            output: typeof output === 'string' ? output : '',
            elapsed,
            rowCount: jsonArray.length,
            isBinary: isBinary ? true : undefined,
            binaryData: isBinary ? output : undefined
          }
        }

        updateTab(activeTabId, { result: res, parsedData: data })
        if (res.success && res.rowCount > 0) {
          addRecord(activeTab.sourceFormat, activeTab.targetFormat, res.rowCount)
        }
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTime)
        updateTab(activeTabId, {
          result: { success: false, output: '', error: err.message || '转换失败', elapsed },
          parsedData: null
        })
      } finally {
        updateTab(activeTabId, { isProcessing: false })
      }
    }, 300)

    return () => {
      if (convertTimerRef.current) clearTimeout(convertTimerRef.current)
    }
  }, [activeTab.input, activeTab.sourceFormat, activeTab.targetFormat, activeTab.sourceOptions, activeTab.targetOptions, activeTabId])

  // 输入变更（预览被编辑时提示冲突）
  const handleInputChange = useCallback((val) => {
    if (activeTab.isPreviewDirty) {
      const ok = window.confirm('输入变更将覆盖已编辑的预览数据，是否继续？')
      if (!ok) return
      // 确认后重置脏标记，新输入会触发重新解析
      updateTab(activeTabId, { isPreviewDirty: false })
    }
    updateTab(activeTabId, { input: val })
  }, [activeTab.isPreviewDirty, activeTabId, updateTab])

  // 源格式变更（预览被编辑时提示冲突）
  const handleSourceFormatChange = useCallback((val) => {
    if (activeTab.isPreviewDirty) {
      const ok = window.confirm('切换源格式将覆盖已编辑的预览数据，是否继续？')
      if (!ok) return
      updateTab(activeTabId, { isPreviewDirty: false })
    }
    updateTab(activeTabId, { sourceFormat: val })
  }, [activeTab.isPreviewDirty, activeTabId, updateTab])
  const handlePreviewDataChange = useCallback((newData) => {
    updateTab(activeTabId, { parsedData: newData, isPreviewDirty: true })
  }, [activeTabId, updateTab])

  // 当 parsedData 变化且是预览编辑触发时，重新 stringify
  useEffect(() => {
    if (!activeTab.isPreviewDirty || !activeTab.parsedData) return
    if (convertTimerRef.current) clearTimeout(convertTimerRef.current)
    convertTimerRef.current = setTimeout(() => {
      const { parsedData, targetFormat, targetOptions } = activeTab
      const jsonArray = parsedData
      try {
        const output = stringifyOutput(jsonArray, targetFormat, targetOptions)
        const elapsed = 0
        updateTab(activeTabId, {
          result: {
            success: true,
            output: typeof output === 'string' ? output : '',
            elapsed,
            rowCount: jsonArray.length,
            isBinary: output instanceof ArrayBuffer ? true : undefined,
            binaryData: output instanceof ArrayBuffer ? output : undefined
          }
        })
      } catch (err) {
        updateTab(activeTabId, {
          result: { success: false, output: '', error: err.message || '转换失败', elapsed: 0 }
        })
      }
    }, 300)
    return () => { if (convertTimerRef.current) clearTimeout(convertTimerRef.current) }
  }, [activeTab.parsedData, activeTab.isPreviewDirty, activeTab.targetFormat, activeTab.targetOptions, activeTabId])

  // Tab 操作
  const handleTabAdd = useCallback(() => {
    const t = createNewTab(tabs.length)
    setTabs(prev => [...prev, t])
    setActiveTabId(t.id)
  }, [tabs.length])

  const handleTabClose = useCallback((id) => {
    if (tabs.length <= 1) return
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (id === activeTabId && next.length > 0) setActiveTabId(next[next.length - 1].id)
      return next
    })
  }, [tabs.length, activeTabId])

  return (
    <div
      spellCheck='false'
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        overflow: 'hidden'
      }}
    >
      <header
        className='flex items-center gap-3 px-4 flex-shrink-0'
        style={{
          height: '48px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)'
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em' }}>
          格式转换套件
        </span>
      </header>

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabAdd={handleTabAdd}
        onTabClose={handleTabClose}
      />

      <Toolbar
        className='flex-shrink-0'
        style={{
          gap: '16px',
          padding: '12px 16px',
          background: 'var(--bg-elevated)'
        }}
      >
        <FormatSelector
          value={activeTab.sourceFormat}
          onChange={handleSourceFormatChange}
          label='源格式'
        />

        <div className='flex items-center gap-2' style={{ color: 'var(--accent)' }}>
          <IconArrowRight size={18} />
        </div>

        <FormatSelector
          value={activeTab.targetFormat}
          onChange={(val) => updateTab(activeTabId, { targetFormat: val })}
          label='目标格式'
        />

        <div className='ml-auto' style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {activeTab.isProcessing && (
            <span style={{ color: 'var(--accent)' }}>处理中...</span>
          )}
        </div>
      </Toolbar>

      <OptionsPanel
        targetFormat={activeTab.targetFormat}
        options={activeTab.targetOptions}
        onChange={(key, value) => updateTab(activeTabId, { targetOptions: { ...activeTab.targetOptions, [key]: value } })}
        onOpenTypeEditor={() => updateTab(activeTabId, { isTypeEditorOpen: true })}
      />

      {(activeTab.targetFormat === 'mysql' || activeTab.targetFormat === 'sparksql') && (
        <ColumnTypePanel
          format={activeTab.targetFormat}
          data={activeTab.parsedData || []}
          overrides={activeTab.targetOptions.columnTypeOverrides || {}}
          onChange={(overrides) => updateTab(activeTabId, { targetOptions: { ...activeTab.targetOptions, columnTypeOverrides: overrides } })}
          onClose={() => updateTab(activeTabId, { isTypeEditorOpen: false })}
          isOpen={activeTab.isTypeEditorOpen}
        />
      )}

      <div className='flex flex-1 overflow-hidden' style={{ flexDirection: 'column', minHeight: 0 }}>
        <div className='flex' style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '12px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <InputPanel
              value={activeTab.input}
              onChange={handleInputChange}
              onFormatChange={handleSourceFormatChange}
              onError={showNotice}
            />
          </div>
          <div style={{ width: '1px', flexShrink: 0, background: 'var(--border)' }} />
          <div style={{ flex: 1, padding: '12px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <OutputPanel
              result={activeTab.result}
              targetFormat={activeTab.targetFormat}
              onDownload={handleDownload}
            />
          </div>
        </div>
        <div style={{ height: '1px', flexShrink: 0, background: 'var(--border)' }} />
        <div style={{ flex: 1, padding: '12px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <PreviewPanel data={activeTab.parsedData} onDataChange={handlePreviewDataChange} />
        </div>
      </div>
      {activeTab.notice && (
        <div
          className='flex items-center gap-2 px-4 flex-shrink-0'
          style={{
            padding: '6px 16px',
            background: activeTab.notice.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
            borderTop: '1px solid var(--border)',
            fontSize: '12px',
            color: activeTab.notice.type === 'error' ? 'var(--error) ' : 'var(--success)'
          }}
        >
          {activeTab.notice.type === 'error' ? <IconAlertCircle size={14} /> : <IconCheck size={14} />}
          {activeTab.notice.message}
        </div>
      )}

      <StatusBar sourceFormat={activeTab.sourceFormat} targetFormat={activeTab.targetFormat} result={activeTab.result} notice={activeTab.notice} />
    </div>
  )
}
