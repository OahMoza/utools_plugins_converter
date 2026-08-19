// CodeEditorArea —— 带行号的代码编辑器（输入/输出共用）
import { useRef } from 'react'

export default function CodeEditorArea({ value, onChange, placeholder, readOnly = false }) {
  const textareaRef = useRef(null)
  const gutterRef = useRef(null)
  const lineCount = Math.max(1, value.split('\n').length)

  const syncScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  return (
    <div className='code-editor-shell'>
      <div ref={gutterRef} className='code-editor-gutter'>
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={`editor-line-${index + 1}`} className='code-editor-line-number'>
            {index + 1}
          </div>
        ))}
      </div>
      <div className='code-editor-body'>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          readOnly={readOnly}
          spellCheck='false'
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          className={`code-editor-textarea ${readOnly ? 'is-readonly' : ''}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
