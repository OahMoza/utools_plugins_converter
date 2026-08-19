// OptionsPanel —— 按目标格式动态渲染的选项面板
import { Button } from '@ztools/ui-kit/Button'
import { IconSettings } from '../Icons.jsx'
import { getOptionsForFormat } from './formatOptions.js'

export default function OptionsPanel({ targetFormat, options, onChange, onOpenTypeEditor }) {
  const formatOptions = getOptionsForFormat(targetFormat)

  if (formatOptions.length === 0) return null

  return (
    <div
      className='flex items-center gap-4 px-4 py-2 flex-wrap'
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
    >
      <span className='text-sm' style={{ color: 'var(--text-muted)' }}>选项:</span>
      {formatOptions.map(opt => (
        <div key={opt.key} className='flex items-center gap-2'>
          <span className='text-sm' style={{ color: 'var(--text-secondary)' }}>{opt.label}</span>
          {opt.type === 'select' && (
            <select
              value={options[opt.key] ?? ''}
              onChange={e => onChange(opt.key, e.target.value)}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                fontSize: '13px'
              }}
            >
              {opt.options?.map(o => (
                <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
              ))}
            </select>
          )}
          {opt.type === 'text' && (
            <input
              type='text'
              value={options[opt.key] ?? ''}
              onChange={e => onChange(opt.key, e.target.value)}
              spellCheck='false'
              autoComplete='off'
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                fontSize: '13px',
                width: '120px'
              }}
            />
          )}
          {opt.type === 'switch' && (
            <button
              onClick={() => onChange(opt.key, !options[opt.key])}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: options[opt.key] ? 'var(--accent)' : 'var(--border)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s'
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: options[opt.key] ? '18px' : '2px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.2s'
              }} />
            </button>
          )}
        </div>
      ))}
      {(targetFormat === 'mysql' || targetFormat === 'sparksql') && onOpenTypeEditor && (
        <Button
          size='sm'
          className='ml-auto'
          onClick={onOpenTypeEditor}
        >
          <IconSettings size={14} />
          字段类型调整
        </Button>
      )}
    </div>
  )
}
