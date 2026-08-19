// 公共卡片 / 面板组件
import './components.css'

export function Card({ children, className = '', style, onClick }) {
  return (
    <div className={`ui-card ${className}`.trim()} style={style} onClick={onClick}>
      {children}
    </div>
  )
}

export function Toolbar({ children, className = '', style }) {
  return (
    <div className={`ui-toolbar ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}

export function Pane({ children, className = '', style, title }) {
  return (
    <section className={`ui-pane ${className}`.trim()} style={style}>
      {title && <h3 className="ui-pane-title">{title}</h3>}
      {children}
    </section>
  )
}
