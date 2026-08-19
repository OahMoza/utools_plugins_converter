// 公共按钮组件
import './components.css'

export function Button({
  children,
  variant = 'default',
  size = 'md',
  disabled = false,
  onClick,
  title,
  className = '',
  type = 'button'
}) {
  const cls = [
    'ui-btn',
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    disabled ? 'ui-btn-disabled' : '',
    className
  ].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}
