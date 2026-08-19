import { jsonToYaml, yamlToJson, validateYaml } from './yaml'
import { jsonToToml, tomlToJson, validateToml } from './toml'
import { jsonToXml, xmlToJson, validateXml } from './xml'
import { jsonToCsv, csvToJson, validateCsv } from './csv'
import { jsonToXlsx, readXlsxFile, downloadXlsx } from './xlsx'
import { jsonToMarkdown, markdownToJson, validateMarkdown } from './markdown'
import { jsonToMysql, mysqlToJson } from './mysql'
import { jsonToHiveSql, hiveSqlToWrapper, validateHiveSql } from './hivesql'

export function parseInput(input, format, options) {
  switch (format) {
    case 'json':
      return JSON.parse(input)
    case 'yaml':
      return yamlToJson(input)
    case 'toml':
      return tomlToJson(input, options)
    case 'xml':
      return xmlToJson(input, options)
    case 'csv':
    case 'xlsx':
      return csvToJson(input, options)
    case 'markdown':
      return markdownToJson(input)
    case 'mysql':
      return mysqlToJson(input)
    case 'sparksql':
      return hiveSqlToWrapper(input)
    default:
      return []
  }
}

export function stringifyOutput(data, format, options) {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'yaml':
      return jsonToYaml(data, options)
    case 'toml':
      return jsonToToml(data, options)
    case 'xml':
      return jsonToXml(data, options)
    case 'csv':
      return jsonToCsv(data, options)
    case 'xlsx':
      return jsonToXlsx(data, options)
    case 'markdown':
      return jsonToMarkdown(data, options)
    case 'mysql':
      return jsonToMysql(data, options)
    case 'sparksql':
      return jsonToHiveSql(data, options)
    default:
      return ''
  }
}

export function validateInput(input, format) {
  switch (format) {
    case 'json':
      try { JSON.parse(input); return true } catch { return false }
    case 'yaml':
      return validateYaml(input)
    case 'toml':
      return validateToml(input)
    case 'xml':
      return validateXml(input)
    case 'csv':
      return validateCsv(input)
    case 'markdown':
      return validateMarkdown(input)
    case 'sparksql':
      return validateHiveSql(input)
    default:
      return false
  }
}

export function autoDetectFormat(input) {
  const trimmed = input.trim()

  if (!trimmed) return 'json'

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {}
  }

  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return 'xml'
  }

  if (trimmed.includes(': ') && trimmed.includes('\n') && !trimmed.includes(',')) {
    try {
      if (validateYaml(trimmed)) return 'yaml'
    } catch {}
  }

  if (trimmed.includes(' = ') && trimmed.includes('[')) {
    try {
      if (validateToml(trimmed)) return 'toml'
    } catch {}
  }

  if (trimmed.startsWith('|') && trimmed.includes('---')) {
    return 'markdown'
  }

  const upper = trimmed.toUpperCase()
  if ((upper.startsWith('INSERT INTO') || upper.startsWith('INSERT OVERWRITE')) && upper.includes('PARTITION') && upper.includes('VALUES')) {
    return 'sparksql'
  }

  if (trimmed.startsWith('<table') || trimmed.startsWith('<tbody') || trimmed.startsWith('<thead')) {
    return 'csv'
  }

  const lines = trimmed.split('\n')
  if (lines.length >= 2) {
    const hasQuotedValues = lines.every(line => {
      const trimmedLine = line.trim()
      return trimmedLine.startsWith('"') && trimmedLine.endsWith('"')
    })
    if (hasQuotedValues) {
      return 'csv'
    }
  }

  if (lines.length >= 1) {
    const firstLine = lines[0]
    const tabCount = (firstLine.match(/\t/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length
    const semiCount = (firstLine.match(/;/g) || []).length
    if (tabCount >= 2 || (tabCount > 0 && tabCount >= commaCount && tabCount >= semiCount)) {
      return 'csv'
    }
  }

  if (lines.length >= 1 && lines.every(line => line.includes('\t') || line.split(',').length > 2)) {
    return 'csv'
  }

  return 'json'
}

export { readXlsxFile, downloadXlsx }
