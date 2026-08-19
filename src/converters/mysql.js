const MYSQL_TYPE_OPTIONS = [
  'BIGINT', 'INT', 'VARCHAR(255)', 'TEXT', 'FLOAT', 'DOUBLE',
  'DECIMAL(10,2)', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP'
]

function inferMySqlType(value) {
  if (value === null || value === undefined) return 'VARCHAR(255)'
  if (typeof value === 'boolean') return 'BOOLEAN'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return 'BIGINT'
    return 'DECIMAL(10,2)'
  }
  if (Array.isArray(value)) return 'TEXT'
  if (typeof value === 'object') return 'TEXT'
  const str = String(value)
  if (str.length > 255) return 'TEXT'
  return 'VARCHAR(255)'
}

// ---------------------------------------------------------------------------
// Tokenizer — turns a MySQL INSERT string into a flat list of tokens so that
// quoted strings, backtick identifiers, numbers and punctuation are never
// confused with each other.
// ---------------------------------------------------------------------------
function tokenize(sql) {
  const tokens = []
  let i = 0
  const n = sql.length

  while (i < n) {
    const ch = sql[i]

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    // String literal: '...'  ('' is an escaped literal quote)
    if (ch === "'") {
      let j = i + 1
      let str = "'"
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            str += "''"
            j += 2
          } else {
            str += "'"
            j++
            break
          }
        } else {
          str += sql[j]
          j++
        }
      }
      tokens.push({ type: 'string', value: str })
      i = j
      continue
    }

    // Backtick-quoted identifier: `...`  (`` is an escaped literal backtick)
    if (ch === '`') {
      let j = i + 1
      let str = '`'
      while (j < n) {
        if (sql[j] === '`') {
          if (sql[j + 1] === '`') {
            str += '``'
            j += 2
          } else {
            str += '`'
            j++
            break
          }
        } else {
          str += sql[j]
          j++
        }
      }
      tokens.push({ type: 'identifier', value: str })
      i = j
      continue
    }

    // Number literal (integer, decimal, scientific notation)
    if ((ch >= '0' && ch <= '9') ||
        (ch === '.' && i + 1 < n && sql[i + 1] >= '0' && sql[i + 1] <= '9')) {
      let j = i
      let str = ''
      while (j < n && ((sql[j] >= '0' && sql[j] <= '9') || sql[j] === '.')) {
        str += sql[j]
        j++
      }
      if (j < n && (sql[j] === 'e' || sql[j] === 'E')) {
        str += sql[j]
        j++
        if (j < n && (sql[j] === '+' || sql[j] === '-')) {
          str += sql[j]
          j++
        }
        while (j < n && sql[j] >= '0' && sql[j] <= '9') {
          str += sql[j]
          j++
        }
      }
      tokens.push({ type: 'number', value: str })
      i = j
      continue
    }

    // Identifier or keyword
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let j = i
      let str = ''
      while (j < n) {
        const c = sql[j]
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') || c === '_') {
          str += c
          j++
        } else {
          break
        }
      }
      const upper = str.toUpperCase()
      if (upper === 'INSERT' || upper === 'INTO' || upper === 'VALUES' ||
          upper === 'NULL' || upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'keyword', value: upper })
      } else {
        tokens.push({ type: 'identifier', value: str })
      }
      i = j
      continue
    }

    // Single-character punctuation
    if (ch === '(' || ch === ')' || ch === ',' || ch === '.' || ch === ';') {
      tokens.push({ type: 'punct', value: ch })
      i++
      continue
    }

    // Anything else: skip (comments, etc. — best effort)
    i++
  }

  return tokens
}

/** Strip surrounding backticks (and unescape `` ` `` → `) from an identifier. */
function stripBackticks(s) {
  if (s.length >= 2 && s.startsWith('`') && s.endsWith('`')) {
    return s.slice(1, -1).replace(/``/g, '`')
  }
  return s
}

/** Convert a single value-token into a JS value. */
function parseValue(token) {
  if (!token) return undefined
  if (token.type === 'punct') return undefined
  if (token.type === 'keyword') {
    if (token.value === 'NULL') return null
    if (token.value === 'TRUE') return true
    if (token.value === 'FALSE') return false
  }
  if (token.type === 'string') {
    return token.value.slice(1, -1).replace(/''/g, "'")
  }
  if (token.type === 'number') return Number(token.value)
  if (token.type === 'identifier') return stripBackticks(token.value)
  return token.value
}

/** Parse a full INSERT statement; returns { database, tableName, columns, rows }. */
function parseInsertStatement(sql) {
  const tokens = tokenize(sql)
  let pos = 0

  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  // INSERT
  let t = next()
  if (!t || t.type !== 'keyword' || t.value !== 'INSERT') return null

  // Skip optional modifiers between INSERT and INTO (e.g. IGNORE, LOW_PRIORITY, DELAYED)
  while (peek() && !(peek().type === 'keyword' && peek().value === 'INTO')) {
    next()
  }

  // INTO
  t = next()
  if (!t || t.type !== 'keyword' || t.value !== 'INTO') return null

  // Table name: [`database`.]`table`
  let tableName = ''
  let database = ''
  t = next()
  if (t && t.type === 'identifier') {
    tableName = stripBackticks(t.value)
  } else if (t && (t.type === 'keyword' || t.type === 'string')) {
    tableName = t.type === 'string' ? t.value.slice(1, -1) : t.value
  }

  if (peek() && peek().type === 'punct' && peek().value === '.') {
    next() // consume .
    database = tableName
    t = next()
    tableName = t ? (t.type === 'identifier' ? stripBackticks(t.value) : t.value) : ''
  }

  // Optional column list: (col1, col2, ...)
  const columns = []
  if (peek() && peek().type === 'punct' && peek().value === '(') {
    next() // consume (
    while (peek()) {
      t = next()
      if (t.type === 'identifier') {
        columns.push(stripBackticks(t.value))
      } else if (t.type === 'keyword') {
        columns.push(t.value) // keyword used as a bare column name
      }
      if (peek() && peek().type === 'punct' && peek().value === ',') {
        next()
        continue
      }
      break
    }
    if (peek() && peek().type === 'punct' && peek().value === ')') next()
  }

  // VALUES
  t = next()
  if (!t || t.type !== 'keyword' || t.value !== 'VALUES') {
    return { database, tableName, columns, rows: [] }
  }

  // Row list: (v1, v2, ...), (v1, v2, ...
  const rows = []
  while (peek()) {
    if (!(peek().type === 'punct' && peek().value === '(')) break
    next() // consume (

    const values = []
    while (peek()) {
      t = next()
      values.push(parseValue(t))
      if (peek() && peek().type === 'punct' && peek().value === ',') {
        next()
        continue
      }
      break
    }

    if (peek() && peek().type === 'punct' && peek().value === ')') next()

    const row = {}
    values.forEach((v, idx) => {
      if (columns[idx] !== undefined) row[columns[idx]] = v
    })
    rows.push(row)

    if (peek() && peek().type === 'punct' && peek().value === ',') {
      next()
      continue
    }
    break
  }

  return { database, tableName, columns, rows }
}

// ---------------------------------------------------------------------------
// Public API (unchanged signatures)
// ---------------------------------------------------------------------------

export { MYSQL_TYPE_OPTIONS, inferMySqlType }

export function mysqlToJson(sql) {
  const parsed = parseInsertStatement(sql)
  if (!parsed) return []
  return parsed.rows
}

export function jsonToMysql(data, options) {
  if (!data || data.length === 0) return ''

  const { database, tableName, batchMode, nullHandling, includeCreateTable, columnTypeOverrides } = options
  const fullTableName = database ? `\`${database}\`.\`${tableName}\`` : `\`${tableName}\``
  const cols = Object.keys(data[0])

  let result = ''
  if (includeCreateTable) {
    result = generateMySqlCreateTable(database || '', tableName, data, columnTypeOverrides) + '\n'
  }

  const shouldSkipColumn = (v) => {
    return nullHandling === 'skip_column' && (v === null || v === undefined)
  }

  const escape = (v, colName) => {
    if (v === null || v === undefined) {
      if (nullHandling === 'skip_column') return '__SKIP__'
      return nullHandling === 'NULL' ? 'NULL' : "''"
    }
    if (v === '') return "''"

    if (colName && columnTypeOverrides?.[colName]) {
      const type = columnTypeOverrides[colName].toUpperCase()
      if (type.includes('INT') || type.includes('DECIMAL') || type.includes('FLOAT') || type.includes('DOUBLE')) {
        const num = Number(v)
        if (Number.isNaN(num) || !Number.isFinite(num)) return 'NULL'
        return String(num)
      }
      if (type.includes('BOOLEAN')) {
        return v ? 'TRUE' : 'FALSE'
      }
      const str = typeof v === 'object' ? JSON.stringify(v) : String(v)
      return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
    }

    if (typeof v === 'number') {
      if (Number.isNaN(v)) return 'NULL'
      if (!Number.isFinite(v)) return 'NULL'
      return String(v)
    }
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    if (typeof v === 'object') {
      return `'${JSON.stringify(v).replace(/'/g, "''")}'`
    }
    const str = String(v)
    if (str.toLowerCase() === 'null') return 'NULL'
    return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
  }

  const colListWithBackticks = cols.map(c => `\`${c}\``).join(', ')

  if (batchMode) {
    const validRows = data.filter(row => {
      return cols.every(c => {
        const val = row[c]
        return !shouldSkipColumn(val)
      })
    })

    if (validRows.length === 0) return result

    const values = validRows.map(row => {
      const vals = cols.map(c => escape(row[c], c))
      return `(${vals.join(', ')})`
    }).join(',\n  ')

    return result + `INSERT INTO ${fullTableName} (${colListWithBackticks}) VALUES\n  ${values};`
  }

  const lines = data.map(row => {
    const filteredCols = nullHandling === 'skip_column'
      ? cols.filter(c => !shouldSkipColumn(row[c]))
      : cols
    const filteredVals = filteredCols.map(c => escape(row[c], c))
    const filteredColList = filteredCols.map(c => `\`${c}\``).join(', ')
    return `INSERT INTO ${fullTableName} (${filteredColList}) VALUES (${filteredVals.join(', ')});`
  })

  return result + lines.join('\n')
}

function generateMySqlCreateTable(database, tableName, data, columnTypeOverrides) {
  if (!data || data.length === 0) return ''
  const cols = Object.keys(data[0])
  const fullTableName = database ? `\`${database}\`.\`${tableName}\`` : `\`${tableName}\``

  const colDefs = cols.map(col => {
    const overrideType = columnTypeOverrides?.[col]
    const type = overrideType || inferMySqlType(data[0][col])
    return `  \`${col}\` ${type}`
  })

  return `CREATE TABLE ${fullTableName} (\n${colDefs.join(',\n')}\n);\n`
}
