'use client'

import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { usePython } from '@/lib/python-bridge'

const STARTER = `# sheets API
# sheets.get_range("A1:C3")  → list of lists
# sheets.get_cell("B2")       → value
# sheets.set_cell("D1", val)
# sheets.set_range("D1:D3", [[1],[2],[3]])

data = sheets.get_range("A1:B5")
total = sum(row[1] for row in data if isinstance(row[1], (int, float)))
sheets.set_cell("C1", total)
print(f"Total: {total}")
`

export function PythonPanel() {
  const [code, setCode] = useState(STARTER)
  const { run, output, running, ready } = usePython()

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-white">
        <span className="text-xs font-medium text-gray-600">Python</span>
        <button
          className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
          onClick={() => run(code)}
          disabled={!ready || running}
        >
          {running ? 'Running…' : ready ? '▶ Run' : 'Loading…'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          language="python"
          value={code}
          onChange={(v) => setCode(v ?? '')}
          theme="vs"
          options={{
            fontSize: 12,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>

      <div className="h-32 border-t border-gray-200 bg-gray-900 text-gray-100 font-mono text-xs p-2 overflow-y-auto">
        <div className="text-gray-500 mb-1">Output</div>
        <pre className="whitespace-pre-wrap">{output}</pre>
      </div>
    </div>
  )
}
