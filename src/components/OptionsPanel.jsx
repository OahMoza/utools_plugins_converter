// OptionsPanel —— 按目标格式动态渲染的选项面板
import { Button } from '@ztools/ui-kit/Button'
import { IconSettings } from '../Icons.jsx'

export default function OptionsPanel({ targetFormat, options, onChange, onOpenTypeEditor }) {
  const getOptionsForFormat = (format) => {
    switch (format) {
      case 'yaml':
        return [
          { key: 'indent', label: '缩进', type: 'select', options: [{ label: '2 空格', value: 2 }, { label: '4 空格', value: 4 }] }
        ]
      case 'csv':
        return [
          { key: 'delimiter', label: '分隔符', type: 'select', options: [{ label: '逗号', value: ',' }, { label: '分号', value: ';' }, { label: '制表符', value: '\t' }] },
          { key: 'header', label: '表头', type: 'switch' }
        ]
      case 'markdown':
        return [
          { key: 'alignment', label: '对齐', type: 'select', options: [{ label: '左对齐', value: 'left' }, { label: '居中', value: 'center' }, { label: '右对齐', value: 'right' }] }
        ]
      case 'mysql':
        return [
          { key: 'database', label: '数据库', type: 'text' },
          { key: 'tableName', label: '表名', type: 'text' },
          { key: 'batchMode', label: '批量模式', type: 'switch' },
          {
            key: 'nullHandling', label: 'NULL处理', type: 'select', options: [
              { label: 'NULL (无引号)', value: 'NULL' },
              { label: '空字符串', value: 'empty_string' },
              { label: '跳过该列', value: 'skip_column' }
            ]
          },
          { key: 'includeCreateTable', label: '包含建表语法', type: 'switch' }
        ]
      case 'sparksql':
        return [
          { key: 'database', label: '数据库', type: 'text' },
          { key: 'tableName', label: '表名', type: 'text' },
          { key: 'writeMode', label: '写入模式', type: 'select', options: [{ label: 'INSERT INTO', value: 'into' }, { label: 'INSERT OVERWRITE', value: 'overwrite' }] },
          { key: 'batchMode', label: '批量模式', type: 'switch' },
          { key: 'partitionMode', label: '分区模式', type: 'select', options: [{ label: '静态分区', value: 'static' }, { label: '动态分区', value: 'dynamic' }] },
          { key: 'staticPartition', label: '静态分区表达式', type: 'text' },
          { key: 'partitionColumns', label: '动态分区列', type: 'text' },
          { key: 'includeCreateTable', label: '包含建表语法', type: 'switch' }
        ]
      case 'toml':
        return [{ key: 'wrapper', label: '包装字段', type: 'text' }]
      case 'xml':
        return [
          { key: 'rootName', label: '根节点', type: 'text' },
          { key: 'itemName', label: '数组项', type: 'text' }
        ]
      default:
        return []
    }
  }

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
