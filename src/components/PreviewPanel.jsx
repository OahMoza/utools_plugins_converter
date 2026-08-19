// PreviewPanel —— 数据表格预览：内联编辑、搜索、复制到 Excel
import { useState, useRef, useEffect } from 'react'
import { Button } from '@ztools/ui-kit/Button'
import { IconTable, IconRotateCw, IconPlus, IconX, IconCheck } from '../Icons.jsx'
import { useEditableTable } from '../hooks/useEditableTable'

export default function PreviewPanel({ data, onDataChange }) {
  const {
    displayData,
    columns,
    isDirty,
    editingCell,
    editValue,
    startEdit,
    setEditValue,
    commitEdit,
    cancelEdit,
    renameColumn,
    addRow,
    removeRow,
    reset
  } = useEditableTable(data || [], Object.keys(data?.[0] || {}))

  const [copied, setCopied] = useState(null)
  const [orientation, setOrientation] = useState('horizontal')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchColumn, setSearchColumn] = useState('')
  const [searchAllColumns, setSearchAllColumns] = useState(true)
  const [hoveredCell, setHoveredCell] = useState(null)
  const [hoveredRow, setHoveredRow] = useState(null)
  const inputRef = useRef(null)

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange && isDirty) {
      onDataChange(displayData)
    }
  }, [displayData, isDirty, onDataChange])

  // Auto-focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  const getFilteredRows = () => {
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

  const escapeTsv = (val) => val.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').replace(/\r/g, ' ')

  const handleCopyToExcel = async () => {
    if (!displayData || displayData.length === 0) return
    if (columns.length === 0) return
    const filteredRows = getFilteredRows()
    const header = columns.map(escapeTsv).join('\t')
    const rows = filteredRows.map(row =>
      columns.map(col => escapeTsv(formatCellValue(row[col]))).join('\t')
    )
    const tsv = [header, ...rows].join('\r\n')
    try {
      await navigator.clipboard.writeText(tsv)
      setCopied('xlsx')
      setTimeout(() => setCopied(null), 2000)
    } catch { }
  }

  const formatCellValue = (value) => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'object') {
      const str = JSON.stringify(value, null, 2)
      return str.length > 100 ? str.slice(0, 100) + '...' : str
    }
    const str = String(value)
    return str.length > 100 ? str.slice(0, 100) + '...' : str
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const filteredRows = getFilteredRows()
  const hasData = displayData && displayData.length > 0
  const isHorizontal = orientation === 'horizontal'
  const isFiltered = filteredRows.length !== (displayData?.length || 0) && searchKeyword.trim().length > 0

  return (
    <div className='flex flex-col' style={{ flex: 1, minHeight: 0 }}>
      {/* Dirty indicator */}
      {isDirty && (
        <div className='flex items-center gap-2 mb-2 flex-shrink-0' style={{
          padding: '6px 12px',
          background: 'var(--warning-bg, #fffbeb)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--warning, #b08830)'
        }}>
          <span>已编辑</span>
          <Button size='sm' variant='ghost' onClick={reset} title='重置为原始数据'>重置</Button>
        </div>
      )}

      {/* Toolbar */}
      <div className='flex items-center gap-2 mb-2 flex-shrink-0 flex-wrap'>
        <span
          className='text-sm font-medium'
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          预览
        </span>
        {hasData && (
          <span className='text-xs' style={{ color: 'var(--text-muted)' }}>
            {isFiltered ? `(${filteredRows.length} / ${displayData.length} 条)` : `(${displayData.length} 条)`}
          </span>
        )}

        {columns.length > 0 && (
          <>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />
            <input
              type='text'
              placeholder='搜索关键词...'
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              spellCheck='false'
              autoComplete='off'
              className='mini-control'
              style={{ width: '120px' }}
            />
            <select
              value={searchAllColumns ? '' : searchColumn}
              onChange={(e) => {
                if (e.target.value === '__all__') {
                  setSearchAllColumns(true)
                  setSearchColumn('')
                } else {
                  setSearchAllColumns(false)
                  setSearchColumn(e.target.value)
                }
              }}
              className='mini-control'
              style={{ maxWidth: '100px' }}
            >
              <option value='__all__'>全部字段</option>
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
            {searchKeyword.length > 0
              ? (
                <Button size='sm' variant='ghost' onClick={() => setSearchKeyword('')} title='清除筛选'>
                  清除
                </Button>
                )
              : (
                <span className='mini-control mini-disabled' style={{ cursor: 'default' }}>
                  清除
                </span>
                )}
          </>
        )}

        {columns.length > 0 && (
          <Button
            size='sm'
            variant='accent'
            onClick={handleCopyToExcel}
            title={`复制${isFiltered ? `筛选后的 ${filteredRows.length} 条` : '全部'}数据到 Excel`}
          >
            <IconTable size={12} />
            {copied === 'xlsx' ? '已复制!' : '复制到 Excel'}
          </Button>
        )}
        <Button
          size='sm'
          className='ml-auto'
          onClick={() => setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
          title='切换表格方向'
        >
          <IconRotateCw size={12} />
          {isHorizontal ? '换纵向' : '换横向'}
        </Button>
      </div>

      {/* Table */}
      <div
        className='flex-1 overflow-auto rounded-lg preview-surface'
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {!hasData
          ? (
            <div className='preview-empty-state'>
              <div className='text-center'>
                <IconTable size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p>请先在左侧输入有效数据</p>
                <p style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted)' }}>支持 JSON 数组格式 · 点击「复制到 Excel」可直接粘贴进表格</p>
              </div>
            </div>
            )
          : columns.length === 0
            ? (
              <div className='preview-empty-state' style={{ fontSize: '13px' }}>
                数据格式不支持表格展示
              </div>
              )
            : filteredRows.length === 0 && searchKeyword.trim()
              ? (
                <div className='preview-empty-state' style={{ fontSize: '13px' }}>
                  未找到匹配的记录
                </div>
                )
              : isHorizontal
                ? (
                  <table className='data-table' style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th className='data-table-th' style={{ width: '40px', textAlign: 'center' }}>#</th>
                        {columns.map(col => (
                          <th
                            key={col}
                            className='data-table-th data-table-th-editable'
                            onClick={() => {
                              const newName = prompt('重命名列', col)
                              if (newName && newName.trim()) renameColumn(col, newName.trim())
                            }}
                            title='点击重命名'
                          >
                            {col}
                          </th>
                        ))}
                        <th className='data-table-th' style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, i) => (
                        <tr
                          key={i}
                          className='data-table-row'
                          onMouseEnter={() => setHoveredRow(i)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className='data-table-td' style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            {i + 1}
                          </td>
                          {columns.map(col => {
                            const isEditing = editingCell && editingCell.row === i && editingCell.col === col
                            const isNull = row[col] === null || row[col] === undefined
                            const isHovered = hoveredCell && hoveredCell.row === i && hoveredCell.col === col
                            return (
                              <td
                                key={col}
                                className='data-table-td data-table-cell-editable'
                                onClick={() => !isEditing && startEdit(i, col)}
                                onMouseEnter={() => setHoveredCell({ row: i, col })}
                                onMouseLeave={() => setHoveredCell(null)}
                                style={{ cursor: 'pointer', position: 'relative' }}
                              >
                                {isEditing
                                  ? (
                                    <input
                                      ref={inputRef}
                                      type='text'
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleEditKeyDown}
                                      onBlur={commitEdit}
                                      className='data-table-edit-input'
                                    />
                                    )
                                  : (
                                    <span style={{ color: isNull ? 'var(--error)' : 'inherit', fontStyle: isNull ? 'italic' : 'normal' }}>
                                      {formatCellValue(row[col])}
                                    </span>
                                    )}
                              </td>
                            )
                          })}
                          <td className='data-table-td' style={{ textAlign: 'center', width: '40px' }}>
                            {hoveredRow === i && (
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => removeRow(i)}
                                title='删除该行'
                                style={{ padding: '2px 6px', fontSize: '14px', color: 'var(--error)' }}
                              >
                                <IconX size={12} />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )
                : (
                  <table className='data-table' style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th className='data-table-th' style={{ width: '40px', textAlign: 'center' }}>#</th>
                        <th
                          className='data-table-th data-table-th-editable'
                          style={{ minWidth: '100px', maxWidth: '200px' }}
                          onClick={() => {
                            // In vertical mode, column headers are row indices
                          }}
                          title=''
                        >
                          字段
                        </th>
                        {filteredRows.map((_, i) => (
                          <th key={i} className='data-table-th' style={{ width: '60px', textAlign: 'center' }}>#{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((col, ci) => (
                        <tr
                          key={col}
                          className='data-table-row'
                          onMouseEnter={() => setHoveredRow(ci)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <td className='data-table-td' style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                            {ci + 1}
                          </td>
                          <td
                            className='data-table-td data-table-th-editable'
                            style={{ fontWeight: 600, color: 'var(--accent)', minWidth: '100px', maxWidth: '200px', cursor: 'pointer' }}
                            onClick={() => {
                              const newName = prompt('重命名列', col)
                              if (newName && newName.trim()) renameColumn(col, newName.trim())
                            }}
                            title='点击重命名'
                          >
                            {col}
                          </td>
                          {filteredRows.map((row, i) => {
                            const isEditing = editingCell && editingCell.row === i && editingCell.col === col
                            const isNull = row[col] === null || row[col] === undefined
                            return (
                              <td
                                key={i}
                                className='data-table-td data-table-cell-editable'
                                onClick={() => !isEditing && startEdit(i, col)}
                                style={{ maxWidth: '150px', textAlign: i === 0 ? 'left' : 'center', cursor: 'pointer' }}
                              >
                                {isEditing
                                  ? (
                                    <input
                                      ref={inputRef}
                                      type='text'
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={handleEditKeyDown}
                                      onBlur={commitEdit}
                                      className='data-table-edit-input'
                                    />
                                    )
                                  : (
                                    <span style={{ color: isNull ? 'var(--error)' : 'var(--text-primary)', fontStyle: isNull ? 'italic' : 'normal' }}>
                                      {formatCellValue(row[col])}
                                    </span>
                                    )}
                              </td>
                            )
                          })}
                          <td className='data-table-td' style={{ textAlign: 'center', width: '40px' }}>
                            {hoveredRow === ci && (
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => removeRow(i)}
                                title='删除该行'
                                style={{ padding: '2px 6px', fontSize: '14px', color: 'var(--error)' }}
                              >
                                <IconX size={12} />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
      </div>

      {/* Add row button */}
      {hasData && columns.length > 0 && (
        <div className='mt-2 flex items-center gap-2'>
          <Button size='sm' variant='ghost' onClick={addRow} title='添加一行'>
            <IconPlus size={12} /> 添加行
          </Button>
          {displayData.length > 500 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              仅显示前 500 条（共 {displayData.length} 条）
            </span>
          )}
        </div>
      )}
    </div>
  )
}
