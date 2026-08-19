import * as TOML from 'smol-toml'

export function jsonToToml(data, options) {
  const wrapper = options?.wrapper ?? 'data'
  const wrapped = { [wrapper]: data }
  return TOML.stringify(wrapped)
}

export function tomlToJson(tomlStr, options) {
  const wrapper = options?.wrapper ?? 'data'
  try {
    const obj = TOML.parse(tomlStr)
    if (obj && typeof obj === 'object' && wrapper in obj) {
      const val = obj[wrapper]
      return Array.isArray(val) ? val : []
    }
    return Array.isArray(obj) ? obj : []
  } catch {
    return []
  }
}

export function validateToml(str) {
  try {
    TOML.parse(str)
    return true
  } catch {
    return false
  }
}
