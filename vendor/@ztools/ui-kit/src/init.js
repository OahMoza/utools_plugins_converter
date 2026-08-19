// 暗色模式初始化：根据 utools.isDarkColors() 给 <html> 加 .dark class
// 各插件 main.jsx 引入并调用 uiKitInitDarkMode()
export function initDarkMode() {
  try {
    if (typeof window !== 'undefined' && window.utools && typeof window.utools.isDarkColors === 'function') {
      if (window.utools.isDarkColors()) {
        document.documentElement.classList.add('dark')
      }
    }
  } catch (e) {
    // 非 uTools 环境静默
  }
}

export default initDarkMode
