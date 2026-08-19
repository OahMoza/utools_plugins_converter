// 公共输入框组件
import './components.css'

export function Input({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  style,
  ...rest
}) {
  return (
    <input
      type="text"
      className={`ui-input ${className}`.trim()}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={onChange}
      style={style}
      spellCheck={false}
      {...rest}
    />
  )
}

export function Textarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  style,
  ...rest
}) {
  return (
    <textarea
      className={`ui-textarea ${className}`.trim()}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={onChange}
      style={style}
      spellCheck={false}
      {...rest}
    />
  )
}
