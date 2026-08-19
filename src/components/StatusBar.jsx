// StatusBar —— 底部状态条：转换路径 / 数据条数 / 耗时 / 状态
import { IconCheck, IconAlertCircle } from '../Icons.jsx'

export default function StatusBar({ sourceFormat, targetFormat, result, notice }) {
  return (
    <div
      className='flex-shrink-0 flex items-center gap-4'
      style={{
        borderTop: '1px solid var(--border)',
        padding: '8px 12px',
        background: 'var(--bg-surface)',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}
    >
      <span>
        <span style={{ color: 'var(--text-muted)' }}>路径:</span>{' '}
        <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
          {sourceFormat.toUpperCase()} → JSON → {targetFormat.toUpperCase()}
        </span>
      </span>
      {result.rowCount !== undefined && result.rowCount > 0 && (
        <span>
          <span style={{ color: 'var(--text-muted)' }}>数据:</span>{' '}
          <span style={{ color: 'var(--success)', fontWeight: 500 }}>
            {result.rowCount} 条
          </span>
        </span>
      )}
      {result.success && (
        <span>
          <span style={{ color: 'var(--text-muted)' }}>耗时:</span>{' '}
          <span style={{ color: 'var(--text-primary)' }}>{result.elapsed}ms</span>
        </span>
      )}
      {notice
        ? (
          <span style={{ color: notice.type === 'error' ? 'var(--error)' : 'var(--success)', marginLeft: 'auto' }}>
            {notice.message}
          </span>
          )
        : result.success
          ? (
            <span style={{ color: 'var(--success)', marginLeft: 'auto' }}>
              <IconCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              成功
            </span>
            )
          : (
            <span style={{ color: 'var(--error)', marginLeft: 'auto' }}>
              <IconAlertCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              等待输入
            </span>
            )}
    </div>
  )
}
