import Papa from 'papaparse'

function autoDetectDelimiter(str) {
  const firstLine = str.split('\n').find(l => l.trim()) || ''
  const delimiters = [',', '\t', ';', '|']

  let best = { delimiter: ',', count: 0 }
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length
    if (count > best.count) {
      best = { delimiter: d, count }
    }
  }
  return best.delimiter
}

function htmlTableToDelimited(html) {
  const cellRegex = /<(?:td|th)(?:\s+[^>]*)?>([^<]*)<\/(?:td|th)>/gi
  const trRegex = /<(?:tr)(?:\s+[^>]*)?>/gi

  const cells = []
  let match
  while ((match = cellRegex.exec(html)) !== null) {
    cells.push(match[1].trim().replace(/&nbsp;/g, ' '))
  }

  const trCount = (html.match(trRegex) || []).length
  if (trCount > 1) {
    const colsPerRow = Math.round(cells.length / trCount)
    const rows = []
    for (let i = 0; i < trCount; i++) {
      rows.push(cells.slice(i * colsPerRow, (i + 1) * colsPerRow))
    }
    const delimiter = colsPerRow > 0 && rows[0] ? '\t' : ','
    return {
      content: rows.map(row => row.join(delimiter)).join('\n'),
      delimiter
    }
  }

  return { content: cells.join('\t'), delimiter: '\t' }
}

export function jsonToCsv(data, options) {
  const delimiter = options?.delimiter ?? ','
  const header = options?.header ?? true
  const normalized = data.map(row => {
    const newRow = {}
    for (const key in row) {
      const val = row[key]
      if (val === null || val === undefined) {
        newRow[key] = 'null'
      } else if (typeof val === 'object') {
        newRow[key] = JSON.stringify(val)
      } else {
        newRow[key] = val
      }
    }
    return newRow
  })
  return Papa.unparse(normalized, { delimiter, header })
}

export function csvToJson(csvStr, options) {
  let normalizedInput = csvStr
  let delimiter = options?.delimiter

  const htmlMatch = csvStr.trim().match(/^<(?:table|tbody|thead)/i)
  if (htmlMatch) {
    const result = htmlTableToDelimited(csvStr)
    normalizedInput = result.content
    delimiter = delimiter || result.delimiter
  }

  if (!delimiter) {
    delimiter = autoDetectDelimiter(normalizedInput)
  }

  const result = Papa.parse(normalizedInput, {
    header: true,
    dynamicTyping: true,
    delimiter,
    skipEmptyLines: true
  })

  return (result.data).map(row => {
    const newRow = {}
    for (const key in row) {
      if (row[key] === 'null') {
        newRow[key] = null
      } else {
        newRow[key] = row[key]
      }
    }
    return newRow
  })
}

export function validateCsv(str) {
  if (!str.trim()) return false
  if (/^<(?:table|tbody|thead)/i.test(str.trim())) return true

  const lines = str.trim().split('\n')
  if (lines.length < 1) return false

  const detected = autoDetectDelimiter(str)
  const firstLineCount = lines[0].split(detected).length

  return lines.every(line => {
    const count = line.split(detected).length
    return count === firstLineCount || !line.trim()
  })
}
