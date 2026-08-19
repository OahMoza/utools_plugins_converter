// TabBar —— 格式转换器多页签，复用 plugins-json 的 TabBar 模式
export function createNewTab(index) {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: `转换 ${index + 1}`,
    // 每 Tab 独立的状态
    input: '',
    sourceFormat: 'json',
    targetFormat: 'yaml',
    sourceOptions: {},
    targetOptions: {},
    result: { success: false, output: '', elapsed: 0 },
    parsedData: null,
    isProcessing: false,
    isTypeEditorOpen: false,
    notice: null
  }
}

export default function TabBar({ tabs, activeTabId, onTabSelect, onTabAdd, onTabClose }) {
  return (
    <div className='fc-tabbar'>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`fc-tab${activeTabId === tab.id ? ' active' : ''}`}
          onClick={() => onTabSelect(tab.id)}
          title={tab.name}
        >
          <span className='fc-tab-name'>{tab.name}</span>
          {tabs.length > 1 && (
            <button
              className='fc-tab-close'
              onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
              title='关闭'
            >×</button>
          )}
        </div>
      ))}
      <button className='fc-tab-add' onClick={onTabAdd} title='新建页签'>+</button>
    </div>
  )
}
