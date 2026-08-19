// ESM 解析钩子：让 Node 能加载转换器里无扩展名的相对 import（Vite 风格）。
// 用法：node --import ./src/converters/__tests__/register-resolver.mjs --test ...
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as pathResolve } from 'node:path'
import { register } from 'node:module'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(js|mjs|cjs|json)$/.test(specifier)) {
    const parentPath = fileURLToPath(context.parentURL)
    const candidate = pathResolve(dirname(parentPath), specifier + '.js')
    if (existsSync(candidate)) {
      return nextResolve(specifier + '.js', context)
    }
  }
  return nextResolve(specifier, context)
}

register(import.meta.url)
