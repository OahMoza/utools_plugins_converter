export function jsonToMarkdown(data, options) {
  if (!data || data.length === 0) return ''

  const alignment = options?.alignment ?? 'left'
  const alignChar = alignment === 'left' ? ':' : alignment === 'center' ? ':' : '-'
  const alignEndChar = alignment === 'center' ? ':' : alignment === 'right' ? ':' : '-'

  const keys = Object.keys(data[0])
  const header = `| ${keys.join(' | ')} |`
  const sep = `| ${keys.map(() => `${alignChar}---${alignEndChar}`).join(' | ')} |`

  const rows = data.map(row => {
    return `| ${keys.map(k => {
      const val = row[k]
      if (val === null || val === undefined) return 'null'
      if (typeof val === 'object') return JSON.stringify(val).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
      return String(val).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
    }).join(' | ')} |`
  })

  return [header, sep, ...rows].join('\n')
}

export function markdownToJson(md) {
  const lines = md.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const separatorPattern = /^\|[\s:-]+\|$/

  const headerLine = lines.find(line => {
    const trimmed = line.trim()
    return trimmed.startsWith('|') && !separatorPattern.test(trimmed)
  })
  if (!headerLine) return []

  const headers = headerLine.split('|').map(s => s.trim()).filter(Boolean)

  return lines
    .filter(line => {
      const trimmed = line.trim()
      return trimmed.startsWith('|') && !separatorPattern.test(trimmed) && line !== headerLine
    })
    .map(line => {
      const vals = line.split('|').map(s => s.trim()).filter(Boolean)
      const obj = {}
      headers.forEach((h, i) => {
        const val = vals[i] ?? ''
        if (val === 'null') {
          obj[h] = null
        } else if (val.startsWith('[') || val.startsWith('{')) {
          try {
            obj[h] = JSON.parse(val.replace(/<br>/g, '\n'))
          } catch {
            obj[h] = val.replace(/<br>/g, '\n')
          }
        } else {
          obj[h] = val.replace(/<br>/g, '\n')
        }
      })
      return obj
    })
}

export function validateMarkdown(str) {
  const lines = str.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return false
  const headerLine = lines[0]
  if (!headerLine.includes('|')) return false
  const hasSeparator = lines.some(l => l.match(/^\|[\s:-]+\|$/))
  return hasSeparator
}
