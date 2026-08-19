import { parse, stringify } from 'yaml'

export function jsonToYaml(data, options) {
  const indent = options?.indent ?? 2
  return stringify(data, { indent, lineWidth: 0 })
}

export function yamlToJson(yamlStr) {
  return parse(yamlStr)
}

export function validateYaml(str) {
  try {
    const result = parse(str)
    return result !== undefined
  } catch {
    return false
  }
}
