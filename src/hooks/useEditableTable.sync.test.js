// useEditableTable.sync.test.js — regression test for the preview-not-showing bug.
//
// The hook seeds its reducer state from the initial props ONCE (lazy initializer).
// Before the fix, passing new `data`/`columns` props was ignored, so the preview
// stayed frozen on the initial empty state. This test renders the REAL hook and
// asserts it re-syncs when the parent passes new data — the exact user symptom.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// jsdom global env (BEFORE importing react-dom)
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/'
})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.getComputedStyle = dom.window.getComputedStyle

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { useEditableTable } = (await import('./useEditableTable.js'))

const rootEl = document.getElementById('root')
const root = createRoot(rootEl)

// Probe component: renders the hook's state as JSON text.
function Probe({ data }) {
  const { displayData, columns } = useEditableTable(data || [], Object.keys(data?.[0] || {}))
  return React.createElement('pre', { id: 'out' },
    JSON.stringify({ rowCount: displayData.length, columns, first: displayData[0] || null }))
}

function renderWith(data) {
  return new Promise((resolve) => {
    root.render(React.createElement(Probe, { data }))
    setTimeout(() => {
      const txt = rootEl.querySelector('#out')?.textContent || ''
      resolve(JSON.parse(txt))
    }, 50)
  })
}

const sample = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 }
]

test('hook re-syncs when parent passes new data (preview shows)', async () => {
  // mount with empty data, as the plugin does on first render
  const s1 = await renderWith([])
  assert.equal(s1.rowCount, 0)
  assert.deepEqual(s1.columns, [])

  // parent passes parsed data (user typed -> parsedData arrives)
  const s2 = await renderWith(sample)
  assert.equal(s2.rowCount, 2, 'preview should now show the 2 rows')
  assert.deepEqual(s2.columns, ['id', 'name', 'age'])
  assert.equal(s2.first.name, 'Alice')
})

test('hook re-syncs again when data changes a second time', async () => {
  await renderWith(sample)
  const bigger = [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
    { id: 3, name: 'C' }
  ]
  const s3 = await renderWith(bigger)
  assert.equal(s3.rowCount, 3, 'preview should reflect the new dataset')
  assert.equal(s3.first.name, 'A')
})
