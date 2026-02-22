import { useState } from 'react'
import { useProjectMapper } from './useProjectMapper'
import GraphCanvas from './GraphCanvas'
import { extColor } from './types'

type InputMode = 'github' | 'folder'

export default function ProjectMapper() {
  const [githubUrl, setGithubUrl] = useState('')
  const [mode, setMode] = useState<InputMode>('github')

  const {
    status, progress, error, graphData, selectedNode, repoName,
    setSelectedNode, analyzeGithub, analyzeFolder, getNodeEdges,
  } = useProjectMapper()

  const nodeInfo = selectedNode ? getNodeEdges(selectedNode.id) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (githubUrl.trim()) analyzeGithub(githubUrl.trim())
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Controls bar ─────────────────────────────────────── */}
      <div className="shrink-0 border-b border-line bg-surface px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode tabs */}
          <div className="flex rounded-lg overflow-hidden border border-line text-sm">
            {(['github', 'folder'] as InputMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  mode === m
                    ? 'bg-acc text-accon'
                    : 'text-fg2 hover:bg-raised hover:text-fg1'
                }`}
              >
                {m === 'github' ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    GitHub URL
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Local Folder
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Input */}
          {mode === 'github' ? (
            <form onSubmit={handleSubmit} className="flex gap-2 flex-1 min-w-0">
              <input
                type="url"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-line bg-bg text-fg1 placeholder:text-fg3 focus:outline-none focus:border-acc"
              />
              <button
                type="submit"
                disabled={status === 'loading' || !githubUrl.trim()}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-acc text-accon hover:opacity-90 disabled:opacity-50 shrink-0 transition-opacity"
              >
                {status === 'loading' ? 'Analyzing…' : 'Analyze'}
              </button>
            </form>
          ) : (
            <button
              onClick={analyzeFolder}
              disabled={status === 'loading'}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-acc text-accon hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {status === 'loading' ? 'Reading…' : 'Pick Folder'}
            </button>
          )}

          {/* Stats */}
          {graphData && (
            <div className="flex items-center gap-3 text-xs text-fg3 ml-auto">
              {repoName && <span className="font-semibold text-fg2">{repoName}</span>}
              <span>{graphData.nodes.length} files</span>
              <span className="text-line">·</span>
              <span>{graphData.edges.length} imports</span>
            </div>
          )}
        </div>

        {/* Progress / error */}
        {status === 'loading' && progress && (
          <p className="text-xs text-fg3 animate-pulse flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-acc border-t-transparent rounded-full animate-spin" />
            {progress}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {error}
          </p>
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Graph canvas */}
        <div className="flex-1 relative bg-bg min-h-0 overflow-hidden">
          {status === 'idle' && !graphData && <EmptyState />}
          {graphData && (
            <GraphCanvas
              data={graphData}
              selectedId={selectedNode?.id ?? null}
              onSelectNode={setSelectedNode}
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedNode && nodeInfo && (
          <aside className="w-72 shrink-0 border-l border-line bg-surface overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-line flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-fg1 break-all">{selectedNode.label}</p>
                <p className="text-xs text-fg3 break-all mt-0.5">{selectedNode.dir || '(root)'}</p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-fg3 hover:text-fg1 hover:bg-raised transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Extension badge */}
              <span
                className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold"
                style={{
                  backgroundColor: extColor(selectedNode.ext) + '25',
                  color: extColor(selectedNode.ext),
                }}
              >
                .{selectedNode.ext}
              </span>

              {/* Imports */}
              {nodeInfo.imports.length > 0 && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-widest font-semibold text-fg3 mb-2">
                    Imports ({nodeInfo.imports.length})
                  </h4>
                  <ul className="space-y-0.5">
                    {nodeInfo.imports.map(id => (
                      <li key={id}>
                        <button
                          onClick={() => setSelectedNode(graphData!.nodes.find(n => n.id === id) ?? null)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-raised text-fg2 hover:text-acc transition-colors flex items-center gap-2 group"
                          title={id}
                        >
                          <span className="text-fg3 shrink-0">→</span>
                          <span className="truncate">{id.split('/').pop()}</span>
                          <span className="text-fg3 truncate text-[10px] hidden group-hover:block">
                            {id}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Imported by */}
              {nodeInfo.importedBy.length > 0 && (
                <section>
                  <h4 className="text-[10px] uppercase tracking-widest font-semibold text-fg3 mb-2">
                    Imported by ({nodeInfo.importedBy.length})
                  </h4>
                  <ul className="space-y-0.5">
                    {nodeInfo.importedBy.map(id => (
                      <li key={id}>
                        <button
                          onClick={() => setSelectedNode(graphData!.nodes.find(n => n.id === id) ?? null)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-raised text-fg2 hover:text-acc transition-colors flex items-center gap-2 group"
                          title={id}
                        >
                          <span className="text-fg3 shrink-0">←</span>
                          <span className="truncate">{id.split('/').pop()}</span>
                          <span className="text-fg3 truncate text-[10px] hidden group-hover:block">
                            {id}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {nodeInfo.imports.length === 0 && nodeInfo.importedBy.length === 0 && (
                <p className="text-xs text-fg3">No import relationships detected for this file.</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-fg3 gap-4 px-8 text-center">
      <svg className="w-20 h-20 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.75}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4zM9 10l6 0M12 7v10" />
      </svg>
      <div>
        <p className="text-sm font-medium text-fg2 mb-1">Visualize your project's file map</p>
        <p className="text-xs leading-relaxed max-w-sm">
          Enter a public GitHub URL or pick a local folder. The tool will scan source files,
          trace <code className="bg-raised px-1 rounded">import</code> / <code className="bg-raised px-1 rounded">require</code> statements,
          and draw an interactive dependency graph.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-[10px]">
        {['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Vue', 'CSS'].map(lang => (
          <span key={lang} className="px-2 py-0.5 rounded-full bg-raised text-fg3">{lang}</span>
        ))}
      </div>
    </div>
  )
}
