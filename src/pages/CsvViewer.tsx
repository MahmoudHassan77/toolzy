import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'

export default function CsvViewer() {
  const [rows, setRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [fileName, setFileName] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const data = ev.target!.result
      const wb = XLSX.read(data, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const arr = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
      if (arr.length > 0) {
        setHeaders(arr[0].map(String))
        setRows(arr.slice(1).map(r => r.map(String)))
      }
      setSortCol(null)
      setSearch('')
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  function toggleSort(col: number) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  const filtered = useMemo(() => {
    let data = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(r => r.some(c => c.toLowerCase().includes(q)))
    }
    if (sortCol !== null) {
      data = [...data].sort((a, b) => {
        const av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
        const an = Number(av), bn = Number(bv)
        const cmp = !isNaN(an) && !isNaN(bn) && av !== '' ? an - bn : av.localeCompare(bv)
        return sortAsc ? cmp : -cmp
      })
    }
    return data
  }, [rows, search, sortCol, sortAsc])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-line bg-surface shrink-0 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer shrink-0">
          <span className="px-4 py-2 text-sm font-medium rounded-lg bg-acc text-accon hover:bg-acch transition-colors cursor-pointer inline-block">
            Open File
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.tsv"
            onChange={handleFile}
            className="hidden"
          />
        </label>
        {fileName && <span className="text-sm text-fg2 truncate max-w-[160px] sm:max-w-xs">{fileName}</span>}
        {rows.length > 0 && (
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rows..."
            className="ml-auto rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-fg1 outline-none focus:border-acc w-full sm:w-48"
          />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-fg3">
          <svg className="w-12 h-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 10h18M3 14h18M3 6h18M3 18h18M7 6v12M12 6v12M17 6v12" />
          </svg>
          <p className="text-sm">Open a CSV, TSV, or Excel file to view it here</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-raised z-10">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    onClick={() => toggleSort(i)}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-fg3 border-b border-line cursor-pointer select-none hover:text-fg1 whitespace-nowrap transition-colors"
                  >
                    {h}
                    {sortCol === i && (
                      <span className="ml-1 text-acc">{sortAsc ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, ri) => (
                <tr key={ri} className="border-b border-line hover:bg-raised transition-colors">
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-4 py-2 text-fg1 whitespace-nowrap max-w-xs truncate">
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-fg3 text-sm">No matching rows</div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="px-6 py-2 border-t border-line text-xs text-fg3 shrink-0">
          {filtered.length} of {rows.length} rows · {headers.length} columns
        </div>
      )}
    </div>
  )
}
