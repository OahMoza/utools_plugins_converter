// OutputPanel —— 输出面板：复制 / XLSX 下载 / 代码编辑
import { useState, useEffect } from 'react'
import { Button } from '@ztools/ui-kit/Button'
import { IconCopy, IconCheck, IconDownload, IconFileSpreadsheet, IconAlertCircle } from '../Icons.jsx'
import CodeEditorArea from './CodeEditorArea'

export default function OutputPanel({ result, targetFormat, onDownload }) {
  const [copied, setCopied] = useState(false)
  const [localOutput, setLocalOutput] = useState(result.output)

  useEffect(() => {
    setLocalOutput(result.output)
  }, [result.output])

  const handleCopy = () => {
    if (localOutput) {
      navigator.clipboard.writeText(localOutput)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const isBinary = targetFormat === 'xlsx'
  const canCopy = !isBinary && result.success && localOutput

  return (
    <div className='flex flex-col' style={{ flex: 1, minHeight: 0 }}>
      <div className='flex items-center gap-2 mb-2 flex-shrink-0 flex-wrap'>
        <span
          className='text-sm font-medium'
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          输出
        </span>
        <div className='flex items-center gap-1 flex-wrap'>
          {canCopy && (
            <Button
              size='sm'
              onClick={handleCopy}
              title='复制结果'
            >
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
              {copied ? '已复制' : '复制'}
            </Button>
          )}
          {isBinary && result.success && (
            <Button
              size='sm'
              onClick={onDownload}
              title='下载 XLSX'
            >
              <IconDownload size={13} />
              下载
            </Button>
          )}
        </div>
      </div>
      <div
        className='flex-1 overflow-auto rounded-lg'
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          minHeight: 0
        }}
      >
        {result.success
          ? isBinary
            ? (
              <div className='flex items-center justify-center h-full' style={{ color: 'var(--text-muted)' }}>
                <div className='text-center'>
                  <IconFileSpreadsheet size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p>XLSX 为二进制格式</p>
                  <p style={{ fontSize: '12px', marginTop: '4px' }}>点击上方的「下载」按钮保存文件</p>
                </div>
              </div>
              )
            : (
              <CodeEditorArea
                value={localOutput}
                onChange={setLocalOutput}
                placeholder='转换结果将显示在这里...'
              />
              )
          : (
            <div className='flex items-center justify-center h-full' style={{ color: 'var(--text-muted)' }}>
              <div className='text-center'>
                <IconAlertCircle size={24} style={{ margin: '0 auto 8px' }} />
                <p>{result.error || '等待输入...'}</p>
              </div>
            </div>
            )}
      </div>
    </div>
  )
}
