// ColumnTypePanel —— MySQL/HiveSQL 字段类型手动覆盖抽屉
import { Button } from '@ztools/ui-kit/Button'
import { IconX } from '../Icons.jsx'
import { inferHiveType, HIVE_TYPE_OPTIONS } from '../converters/hivesql'
import { inferMySqlType, MYSQL_TYPE_OPTIONS } from '../converters/mysql'

export default function ColumnTypePanel({ format, data, overrides, onChange, onClose, isOpen }) {
  const cols = data && data.length > 0 ? Object.keys(data[0]) : []
  const inferFn = format === 'mysql' ? inferMySqlType : inferHiveType
  const typeOptions = format === 'mysql' ? MYSQL_TYPE_OPTIONS : HIVE_TYPE_OPTIONS
  const typeLabel = format === 'mysql' ? 'MySQL' : 'HiveSQL'

  const getInferredType = (col) => {
    for (const row of data) {
      if (row[col] !== null && row[col] !== undefined) {
        return inferFn(row[col])
      }
    }
    return inferFn(null)
  }

  const handleChange = (col, type) => {
    const next = { ...overrides }
    if (type === '__AUTO__') {
      delete next[col]
    } else {
      next[col] = type
    }
    onChange(next)
  }

  const handleResetAll = () => {
    onChange({})
  }

  const overriddenCount = Object.keys(overrides).length

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: '60%',
          backgroundColor: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.2), -8px 0 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              📐 列类型配置
            </span>
            {cols.length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: overriddenCount > 0 ? 'rgba(201, 118, 66, 0.12)' : 'rgba(74, 140, 85, 0.10)',
                  color: overriddenCount > 0 ? '#c97642' : '#4a8c55',
                  fontWeight: 500
                }}
              >
                {cols.length} 列{overriddenCount > 0 ? ` · ${overriddenCount} 已覆盖` : ' · 自动推断'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {overriddenCount > 0 && (
              <Button size='sm' variant='ghost' onClick={handleResetAll}>
                重置为自动
              </Button>
            )}
            <Button size='sm' variant='ghost' onClick={onClose} title='关闭'>
              <IconX size={18} />
            </Button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
          {cols.length === 0
            ? (
              <div className='text-center py-10' style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                无可用字段（请先提供有效的 JSON 数据）
              </div>
              )
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '30%' }}>
                      列名
                    </th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '30%' }}>
                      自动推断 ({typeLabel})
                    </th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', width: '40%' }}>
                      手动覆盖（可选）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cols.map(col => {
                    const inferred = getInferredType(col)
                    const isOverridden = col in overrides
                    return (
                      <tr key={col}>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {col}
                        </td>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {inferred}
                          {!isOverridden && (
                            <span style={{ display: 'inline-block', padding: '0 4px', borderRadius: '3px', background: 'rgba(74, 140, 85, 0.10)', color: '#4a8c55', fontSize: '9px', fontWeight: 500, marginLeft: '4px' }}>
                              自动
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                          <select
                            value={isOverridden ? overrides[col] : '__AUTO__'}
                            onChange={e => handleChange(col, e.target.value)}
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: isOverridden ? '1px solid var(--accent)' : '1px solid var(--border)',
                              background: isOverridden ? 'rgba(201, 118, 66, 0.06)' : 'var(--bg-elevated)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--text-primary)',
                              minWidth: '120px'
                            }}
                          >
                            <option value='__AUTO__'>🔁 使用自动推断</option>
                            {typeOptions.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          {isOverridden && (
                            <span style={{ fontSize: '10px', color: 'var(--accent)', marginLeft: '6px' }}>
                              ⬅️ 已覆盖
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              )}
        </div>
      </div>
    </>
  )
}
