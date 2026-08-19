const HIVE_TYPE_OPTIONS = [
  'STRING', 'BIGINT', 'INT', 'DOUBLE', 'FLOAT', 'BOOLEAN',
  'DECIMAL(10,2)', 'DECIMAL', 'DATE', 'TIMESTAMP',
  'ARRAY<STRING>', 'MAP<STRING,STRING>'
]

function escape(value, nullHandling, overrideType) {
  if (value === null || value === undefined) {
    return nullHandling === 'NULL' ? 'NULL' : "''"
  }
  if (value === '') return "''"

  if (overrideType) {
    const type = overrideType.toUpperCase()
    if (type.includes('INT') || type.includes('DECIMAL') || type.includes('DOUBLE') || type.includes('FLOAT')) {
      const num = Number(value)
      if (Number.isNaN(num) || !Number.isFinite(num)) return 'NULL'
      return String(num)
    }
    if (type.includes('BOOLEAN')) {
      return value ? 'TRUE' : 'FALSE'
    }
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NULL'
    if (!Number.isFinite(value)) return 'NULL'
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`
  }
  const str = String(value)
  if (str.toLowerCase() === 'null') return 'NULL'
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`
}

function inferHiveType(value) {
  if (value === null || value === undefined) return 'STRING'
  if (typeof value === 'boolean') return 'BOOLEAN'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return 'BIGINT'
    return 'DOUBLE'
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) return 'ARRAY<STRING>'
    return 'MAP<STRING,STRING>'
  }
  return 'STRING'
}

function generateCreateTable(tableName, cols, dataRows, partitionCols, nullHandling, columnTypeOverrides) {
  const colDefs = []
  const allCols = [...cols]

  for (const col of allCols) {
    const overrideType = columnTypeOverrides?.[col]
    if (overrideType) {
      colDefs.push(`  \`${col}\` ${overrideType}`)
      continue
    }
    let sampleValue = null
    for (const row of dataRows) {
      if (row[col] !== null && row[col] !== undefined) {
        sampleValue = row[col]
        break
      }
    }
    const hiveType = inferHiveType(sampleValue)
    colDefs.push(`  \`${col}\` ${hiveType}`)
  }

  let partitionClause = ''
  if (partitionCols.length > 0) {
    const partDefs = partitionCols.map(c => {
      const overrideType = columnTypeOverrides?.[c]
      if (overrideType) return `  \`${c}\` ${overrideType}`
      const idx = allCols.indexOf(c)
      let sampleValue = null
      if (idx !== -1) {
        for (const row of dataRows) {
          if (row[c] !== null && row[c] !== undefined) {
            sampleValue = row[c]
            break
          }
        }
      }
      const hiveType = inferHiveType(sampleValue)
      return `  \`${c}\` ${hiveType}`
    })
    partitionClause = `\nPARTITIONED BY (\n${partDefs.join(',\n')}\n)`
  }

  return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n${colDefs.join(',\n')}\n)${partitionClause}\nTBLPROPERTIES (\n  'serialization.null.format'='${nullHandling === 'NULL' ? 'NULL' : "''"}'\n);`
}

export { inferHiveType, HIVE_TYPE_OPTIONS }

export function jsonToHiveSql(input, options) {
  const database = options.database || ''
  const tableName = options.tableName || 'table_name'
  const fullTableName = database ? `\`${database}\`.\`${tableName}\`` : `\`${tableName}\``
  const writeMode = options.writeMode || 'into'
  const batchMode = options.batchMode !== false
  const nullHandling = options.nullHandling || 'NULL'
  const partitionMode = options.partitionMode || 'static'
  const partitionColumns = options.partitionColumns !== undefined && options.partitionColumns !== '' ? options.partitionColumns : ''
  const staticPartition = options.staticPartition !== undefined && options.staticPartition !== '' ? options.staticPartition : ''

  let rows = []
  let finalTableName = fullTableName
  let partitionSpec = ''

  if (Array.isArray(input)) {
    rows = input
  } else if (input && typeof input === 'object' && 'rows' in input) {
    const wrapper = input
    rows = wrapper.rows || []
    if (wrapper.tableName) finalTableName = wrapper.tableName
  }

  if (!rows || rows.length === 0) return ''

  const cols = Object.keys(rows[0])

  if (partitionMode === 'static') {
    if (!partitionSpec && staticPartition && staticPartition.trim()) {
      partitionSpec = ` PARTITION (${staticPartition})`
    }
  }

  const dynamicPartCols = partitionMode === 'dynamic' && partitionColumns
    ? partitionColumns.split(',').map(c => c.trim()).filter(Boolean)
    : []

  const staticPartKeys = new Set()
  if (partitionMode === 'static' && partitionSpec) {
    const match = partitionSpec.match(/PARTITION \(([^)]+)\)/)
    if (match) {
      const partExpr = match[1]
      const kvPairs = partExpr.split(',').map(s => s.trim())
      kvPairs.forEach(pair => {
        const eqIdx = pair.indexOf('=')
        if (eqIdx > -1) {
          staticPartKeys.add(pair.substring(0, eqIdx).trim())
        } else {
          staticPartKeys.add(pair.trim())
        }
      })
    }
  }

  const dataCols = dynamicPartCols.length > 0
    ? cols.filter(c => !dynamicPartCols.includes(c))
    : cols.filter(c => !staticPartKeys.has(c))

  const valuesCols = dynamicPartCols.length > 0
    ? [...dataCols, ...dynamicPartCols.filter(c => cols.includes(c))]
    : dataCols

  const colList = dataCols.map(c => `\`${c}\``).join(', ')
  const insertStart = writeMode === 'overwrite'
    ? `INSERT OVERWRITE ${finalTableName}`
    : `INSERT INTO ${finalTableName}`

  let insertSql
  if (batchMode) {
    if (partitionMode === 'dynamic' && dynamicPartCols.length > 0) {
      const partCol = dynamicPartCols[0]
      const partValue = rows[0]?.[partCol] ?? 'unknown'
      const values = rows.map(row => {
        const vals = valuesCols.map(c => escape(row[c], nullHandling, options.columnTypeOverrides?.[c]))
        return `(${vals.join(', ')})`
      }).join(',\n  ')
      insertSql = `${insertStart} PARTITION (${partCol}='${partValue}') (${colList}) VALUES\n  ${values};`
    } else {
      insertSql = `${insertStart}${partitionSpec} (${colList}) VALUES\n  ${rows.map(row => {
        const vals = valuesCols.map(c => escape(row[c], nullHandling, options.columnTypeOverrides?.[c]))
        return `(${vals.join(', ')})`
      }).join(',\n  ')};`
    }
  } else {
    insertSql = rows.map(row => {
      const vals = valuesCols.map(c => escape(row[c], nullHandling, options.columnTypeOverrides?.[c]))
      if (partitionMode === 'dynamic' && dynamicPartCols.length > 0) {
        const partCol = dynamicPartCols[0]
        const partValue = row[partCol] ?? 'unknown'
        return `${insertStart} PARTITION (${partCol}='${partValue}') (${colList}) VALUES (${vals.join(', ')});`
      }
      return `${insertStart}${partitionSpec} (${colList}) VALUES (${vals.join(', ')});`
    }).join('\n')
  }

  if (options.includeCreateTable) {
    const createTableSql = generateCreateTable(
      finalTableName,
      dataCols,
      rows,
      dynamicPartCols.length > 0 ? dynamicPartCols : [],
      nullHandling,
      options.columnTypeOverrides
    )
    return `${createTableSql}\n\n${insertSql}`
  }

  return insertSql
}

// ---------------------------------------------------------------------------
// Tokenizer — turns a HiveSQL INSERT string into a flat list of tokens so that
// quoted strings, backtick identifiers, numbers and punctuation are never
// confused with each other. This is the same state-machine approach used by the
// MySQL parser; we additionally recognise `=` (for PARTITION specs) and the
// OVERWRITE / PARTITION keywords.
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
      if (upper === 'INSERT' || upper === 'INTO' || upper === 'OVERWRITE' ||
          upper === 'PARTITION' || upper === 'VALUES' ||
          upper === 'NULL' || upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'keyword', value: upper })
      } else {
        tokens.push({ type: 'identifier', value: str })
      }
      i = j
      continue
    }

    // Single-character punctuation
    if (ch === '(' || ch === ')' || ch === ',' || ch === '.' || ch === ';' || ch === '=') {
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

/**
 * Build a partition object from the tokens found inside PARTITION (...).
 * Static partitions contain `=` (e.g. `dt='2024-01-01'`) and we extract the
 * key/value pairs. Dynamic partitions list bare column names only, so there is
 * nothing to extract here and we return an empty object.
 */
function buildPartition(specTokens) {
  const hasEquals = specTokens.some(tk => tk.type === 'punct' && tk.value === '=')
  if (!hasEquals) return {}

  const partition = {}
  let keyParts = []
  let valParts = []
  let inValue = false

  const flush = () => {
    if (keyParts.length === 0) return
    const key = keyParts.map(tk => stripBackticks(tk.value)).join('')
    const val = valParts[0] !== undefined ? parseValue(valParts[0]) : undefined
    partition[key] = val
    keyParts = []
    valParts = []
    inValue = false
  }

  for (const tk of specTokens) {
    if (tk.type === 'punct' && tk.value === ',') {
      flush()
      continue
    }
    if (!inValue) {
      if (tk.type === 'punct' && tk.value === '=') {
        inValue = true
      } else {
        keyParts.push(tk)
      }
    } else {
      valParts.push(tk)
    }
  }
  flush()
  return partition
}

/**
 * Parse a full HiveSQL INSERT statement and return
 * { tableName, partition, rows }.
 *
 * HiveSQL grammar (simplified):
 *   INSERT [INTO|OVERWRITE] [db.]table [PARTITION (spec)] [(col_list)] VALUES ...
 *
 * The PARTITION clause and the column list may appear in either order, so we
 * loop over them until we hit the VALUES keyword.
 */
function parseHiveInsert(sql) {
  const tokens = tokenize(sql)
  let pos = 0

  const peek = () => tokens[pos]
  const eat = () => tokens[pos++]

  // INSERT
  let t = eat()
  if (!t || t.type !== 'keyword' || t.value !== 'INSERT') return null

  // Optional INTO / OVERWRITE between INSERT and the table name.
  if (peek() && peek().type === 'keyword' && peek().value === 'INTO') eat()
  if (peek() && peek().type === 'keyword' && peek().value === 'OVERWRITE') eat()

  // Optional TABLE keyword (SparkSQL allows `INSERT OVERWRITE TABLE t`).
  if (peek() && (peek().value.toUpperCase?.() === 'TABLE')) eat()

  // Table name: [`db`.]`table`
  let tableName = ''
  t = eat()
  if (t && t.type === 'identifier') {
    tableName = stripBackticks(t.value)
  } else if (t && t.type === 'string') {
    tableName = t.value.slice(1, -1)
  } else if (t) {
    tableName = t.value
  }

  // Optional `db`.`table`. Preserve the historical behaviour of returning the
  // database component as `tableName` (matches existing test expectations).
  if (peek() && peek().type === 'punct' && peek().value === '.') {
    eat() // consume .
    eat() // consume the actual table identifier
  }

  // PARTITION spec and the optional column list can appear in either order.
  const partition = {}
  const columns = []

  while (peek()) {
    const cur = peek()
    if (cur.type === 'keyword' && cur.value === 'PARTITION') {
      eat() // consume PARTITION
      if (peek() && peek().type === 'punct' && peek().value === '(') {
        eat() // consume (
        const spec = []
        let depth = 1
        while (peek() && depth > 0) {
          const tk = eat()
          if (tk.type === 'punct' && tk.value === '(') depth++
          else if (tk.type === 'punct' && tk.value === ')') depth--
          if (depth > 0) spec.push(tk)
        }
        Object.assign(partition, buildPartition(spec))
      }
      continue
    }
    if (cur.type === 'punct' && cur.value === '(') {
      eat() // consume (
      while (peek()) {
        const tk = eat()
        if (tk.type === 'identifier') {
          columns.push(stripBackticks(tk.value))
        } else if (tk.type === 'keyword') {
          columns.push(tk.value) // keyword used as a bare column name
        }
        if (peek() && peek().type === 'punct' && peek().value === ',') {
          eat()
          continue
        }
        break
      }
      if (peek() && peek().type === 'punct' && peek().value === ')') eat()
      continue
    }
    break
  }

  // VALUES
  t = eat()
  if (!t || t.type !== 'keyword' || t.value !== 'VALUES') {
    return null
  }

  // Row list: (v1, v2, ...), (v1, v2, ...)
  const rows = []
  while (peek()) {
    if (!(peek().type === 'punct' && peek().value === '(')) break
    eat() // consume (

    const values = []
    while (peek()) {
      const tk = eat()
      values.push(parseValue(tk))
      if (peek() && peek().type === 'punct' && peek().value === ',') {
        eat()
        continue
      }
      break
    }
    if (peek() && peek().type === 'punct' && peek().value === ')') eat()

    const row = {}
    values.forEach((v, idx) => {
      if (columns[idx] !== undefined) row[columns[idx]] = v
    })
    rows.push(row)

    if (peek() && peek().type === 'punct' && peek().value === ',') {
      eat()
      continue
    }
    break
  }

  return { tableName, partition, rows }
}

// ---------------------------------------------------------------------------
// Public API (unchanged signatures)
// ---------------------------------------------------------------------------

export function hiveSqlToWrapper(sql) {
  const trimmed = sql.trim()
  const upper = trimmed.toUpperCase()

  if (!upper.startsWith('INSERT INTO') && !upper.startsWith('INSERT OVERWRITE')) {
    return null
  }

  return parseHiveInsert(trimmed) || null
}

export function validateHiveSql(sql) {
  const trimmed = sql.trim()
  const upper = trimmed.toUpperCase()
  if (!upper.startsWith('INSERT INTO') && !upper.startsWith('INSERT OVERWRITE')) return false
  if (upper.includes('SELECT ') || upper.includes(' FROM ')) return false
  if (!upper.includes('VALUES')) return false
  return true
}
