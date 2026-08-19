const fs = require('node:fs')
const path = require('node:path')

// 通过 window 对象向渲染进程注入 nodejs 能力（格式转换器：导入 / 导出文件）
window.services = {
  // 读文件（导入入口）
  readFile (file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  },
  // 文本写入到下载目录（保存转换结果）
  writeTextFile (text, ext = 'txt') {
    const filePath = path.join(
      window.utools.getPath('downloads'),
      Date.now().toString() + '.' + ext
    )
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  // 图片写入到下载目录（保留兼容）
  writeImageFile (base64Url) {
    const matchs = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
    if (!matchs) return
    const filePath = path.join(window.utools.getPath('downloads'), Date.now().toString() + '.' + matchs[1])
    fs.writeFileSync(filePath, base64Url.substring(matchs[0].length), { encoding: 'base64' })
    return filePath
  }
}

// MCP 工具注册（供 AI 客户端通过 uTools 调用格式转换能力）
// 必须在 preload 顶层作用域注册（不可写在 onPluginEnter 内）
try {
  // convert_format: { input, sourceFormat, targetFormat, options }
  //   input: 源格式文本字符串
  //   sourceFormat: json|yaml|toml|xml|csv|markdown|xlsx|mysql|sparksql
  //   targetFormat: 同上
  //   options: 目标格式选项（可选，如 csv 的 delimiter、yaml 的 indent）
  window.utools.registerTool('convert_format', (params) => {
    if (!window.services?.__convert) return { error: '转换能力未就绪' }
    const { input, sourceFormat, targetFormat, options } = params || {}
    if (typeof input !== 'string' || !input.trim()) {
      return { error: '参数 input 为空或非字符串' }
    }
    if (!sourceFormat || !targetFormat) {
      return { error: '参数 sourceFormat/targetFormat 必填' }
    }
    return window.services.__convert(input, sourceFormat, targetFormat, options || {})
  })
} catch (e) {
  // 非 uTools 环境或注册失败时静默
}
