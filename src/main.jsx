import React from 'react'
import ReactDOM from 'react-dom/client'
// 设计系统：ui-kit 令牌（CSS 变量） + 暗色初始化
import '@ztools/ui-kit/tokens.css'
import { initDarkMode } from '@ztools/ui-kit/init'
import App from './App.jsx'
// 迁移自源 style.css 的自定义组件类 + Tailwind 工具类替代
import './utilities.css'
import './App.css'

initDarkMode()

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
