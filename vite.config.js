import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: [
      { find: '@ztools/ui-kit/tokens.css', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/tokens.css') },
      { find: '@ztools/ui-kit/components/components.css', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/components/components.css') },
      { find: '@ztools/ui-kit/Button', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/components/Button.jsx') },
      { find: '@ztools/ui-kit/Input', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/components/Input.jsx') },
      { find: '@ztools/ui-kit/Textarea', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/components/Input.jsx') },
      { find: '@ztools/ui-kit/Card', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/components/Card.jsx') },
      { find: '@ztools/ui-kit/Toolbar', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/components/Card.jsx') },
      { find: '@ztools/ui-kit/Pane', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/components/Card.jsx') },
      { find: '@ztools/ui-kit/init', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/init.js') },
      { find: '@ztools/ui-kit', replacement: path.resolve(__dirname, 'vendor/@ztools/ui-kit/src/index.js') }
    ]
  },
  optimizeDeps: {
    include: ['xlsx', 'papaparse', 'fast-xml-parser', 'smol-toml', 'yaml']
  }
})
