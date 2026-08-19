import { XMLParser, XMLBuilder } from 'fast-xml-parser'

export function jsonToXml(data, options) {
  const rootName = options?.rootName ?? 'root'
  const itemName = options?.itemName ?? 'item'
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  })
  return builder.build({ [rootName]: { [itemName]: data } })
}

export function xmlToJson(xmlStr, options) {
  const rootName = options?.rootName ?? 'root'
  const itemName = options?.itemName ?? 'item'
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  })
  try {
    const obj = parser.parse(xmlStr)
    if (obj && obj[rootName] && obj[rootName][itemName] !== undefined) {
      const items = obj[rootName][itemName]
      return Array.isArray(items) ? items : [items]
    }
    return []
  } catch {
    return []
  }
}

export function validateXml(str) {
  try {
    const parser = new XMLParser()
    parser.parse(str)
    return true
  } catch {
    return false
  }
}
