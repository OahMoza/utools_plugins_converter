// @ztools/ui-kit 统一导出入口

// 样式（按顺序：tokens → 组件）
import './tokens.css'
import './components/components.css'

// 暗色初始化
export { initDarkMode } from './init.js'

// 公共组件
export { Button } from './components/Button.jsx'
export { Input, Textarea } from './components/Input.jsx'
export { Card, Toolbar, Pane } from './components/Card.jsx'

// 模板组件（保留兼容，供 plugins-auth/format-converter 过渡期使用）
export { default as App } from './App.jsx'
export { default as Hello } from './Hello/index.jsx'
export { default as Read } from './Read/index.jsx'
export { default as Write } from './Write/index.jsx'
