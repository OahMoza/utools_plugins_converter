// FormatSelector —— 源/目标格式下拉选择器
const FORMATS = ['json', 'yaml', 'toml', 'xml', 'csv', 'markdown', 'xlsx', 'mysql', 'sparksql']

const FORMAT_LABELS = {
  json: { short: 'JSON' },
  yaml: { short: 'YAML' },
  toml: { short: 'TOML' },
  xml: { short: 'XML' },
  csv: { short: 'CSV' },
  xlsx: { short: 'XLSX' },
  markdown: { short: 'MD' },
  mysql: { short: 'MySQL' },
  sparksql: { short: 'HiveSQL' }
}

export default function FormatSelector({ value, onChange, label, disabledFormats = [] }) {
  const formats = FORMATS.filter(f => !disabledFormats.includes(f))

  return (
    <div className='flex items-center gap-2'>
      <span
        className='text-sm font-medium'
        style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className='px-3 py-1.5 rounded-lg border text-sm font-medium'
        style={{
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer'
        }}
      >
        {formats.map(f => (
          <option key={f} value={f}>{FORMAT_LABELS[f].short}</option>
        ))}
      </select>
    </div>
  )
}

export { FORMATS, FORMAT_LABELS }
