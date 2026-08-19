// InputPanel —— 输入面板：文件导入 / 粘贴 / 自动检测 + 代码编辑器
import { useRef } from 'react'
import { Button } from '@ztools/ui-kit/Button'
import { IconFileUp } from '../Icons.jsx'
import { readXlsxFile, autoDetectFormat } from '../converters'
import CodeEditorArea from './CodeEditorArea'

export default function InputPanel({ value, onChange, onFormatChange, onError }) {
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const data = await readXlsxFile(file)
        const jsonStr = JSON.stringify(data, null, 2)
        onChange(jsonStr)
        onFormatChange('json')
      } catch (err) {
        onError?.('读取 XLSX 文件失败: ' + err.message)
      }
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        onChange(ev.target?.result || '')
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      onChange(text)
    } catch {
      onError?.('无法访问剪贴板，请手动粘贴')
    }
  }

  const handleAutoDetect = () => {
    if (!value.trim()) return
    onFormatChange(autoDetectFormat(value))
  }

  return (
    <div className='flex flex-col' style={{ flex: 1, minHeight: 0 }}>
      <div className='flex items-center gap-2 mb-2 flex-shrink-0 flex-wrap'>
        <span
          className='text-sm font-medium'
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          输入
        </span>
        <div className='flex items-center gap-1 flex-wrap'>
          <input
            ref={fileInputRef}
            type='file'
            accept='.json,.yaml,.yml,.toml,.xml,.csv,.txt,.xlsx,.xls'
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            size='sm'
            onClick={() => fileInputRef.current?.click()}
            title='导入文件'
          >
            <IconFileUp size={13} />
            导入
          </Button>
          <Button
            size='sm'
            onClick={handlePaste}
            title='从剪贴板粘贴'
          >
            粘贴
          </Button>
          <Button
            size='sm'
            onClick={handleAutoDetect}
            title='自动检测格式'
          >
            自动检测
          </Button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CodeEditorArea
          value={value}
          onChange={onChange}
          placeholder={'粘贴或输入数据...\n支持格式: JSON, YAML, TOML, XML, CSV, Markdown'}
        />
      </div>
    </div>
  )
}
