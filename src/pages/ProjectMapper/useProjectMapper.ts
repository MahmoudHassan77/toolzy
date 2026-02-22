import { useState, useCallback } from 'react'
import { GraphData, GraphNode, GraphEdge, Status } from './types'
import { extractRelativeImports, resolveImport, findFile } from './parseImports'
import { parseGithubUrl, fetchGithubFiles } from './githubApi'
import { runForceLayout } from './forceLayout'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandle = any

const SOURCE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'vue', 'svelte', 'astro',
  'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'cs',
  'rb', 'php', 'swift', 'kt',
  'css', 'scss', 'sass', 'less',
  'json', 'yaml', 'yml', 'toml',
])

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '__pycache__',
  'vendor', 'coverage', '.git', '.svn', 'target',
])

function getExt(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot + 1).toLowerCase()
}

function getLabel(path: string): string {
  return path.split('/').pop() ?? path
}

function getDir(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
}

function buildGraph(files: Array<{ path: string; content: string }>): GraphData {
  const knownFiles = new Set(files.map(f => f.path))

  const nodes: GraphNode[] = files.map(f => ({
    id: f.path,
    label: getLabel(f.path),
    ext: getExt(f.path),
    dir: getDir(f.path),
    x: 0, y: 0, vx: 0, vy: 0,
  }))

  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>()

  for (const file of files) {
    const imports = extractRelativeImports(file.content)
    for (const imp of imports) {
      const resolved = resolveImport(file.path, imp)
      const target = findFile(resolved, knownFiles)
      if (target && target !== file.path) {
        const key = `${file.path}→${target}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push({ source: file.path, target })
        }
      }
    }
  }

  return { nodes, edges }
}

async function readFolderRecursive(
  dirHandle: AnyHandle,
  basePath: string,
  files: Array<{ path: string; content: string }>,
  maxFiles: number,
  onProgress: (msg: string) => void
): Promise<void> {
  for await (const entry of dirHandle.values() as AsyncIterable<FileSystemHandle>) {
    if (files.length >= maxFiles) break

    const name = entry.name
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue

    const entryPath = basePath ? `${basePath}/${name}` : name

    if (entry.kind === 'directory') {
      await readFolderRecursive(entry as AnyHandle, entryPath, files, maxFiles, onProgress)
    } else {
      const ext = getExt(name)
      if (SOURCE_EXTS.has(ext)) {
        const file = await (entry as FileSystemFileHandle).getFile()
        const content = await file.text()
        files.push({ path: entryPath, content })
        if (files.length % 10 === 0) onProgress(`Reading files… (${files.length} found)`)
      }
    }
  }
}

export function useProjectMapper() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [repoName, setRepoName] = useState('')

  const finalize = (files: Array<{ path: string; content: string }>) => {
    if (files.length === 0) throw new Error('No source files found.')
    setProgress(`Building dependency graph from ${files.length} files…`)
    const graph = buildGraph(files)
    setProgress('Running force layout…')
    const laid = runForceLayout(graph.nodes, graph.edges, 1400, 900)
    setGraphData({ ...graph, nodes: laid })
    setStatus('done')
  }

  const analyzeGithub = useCallback(async (url: string) => {
    const parsed = parseGithubUrl(url)
    if (!parsed) {
      setError('Invalid GitHub URL. Example: https://github.com/owner/repo')
      return
    }
    setStatus('loading')
    setError(null)
    setGraphData(null)
    setSelectedNode(null)
    setRepoName(`${parsed.owner}/${parsed.repo}`)
    try {
      const files = await fetchGithubFiles(
        parsed.owner, parsed.repo, parsed.branch,
        msg => setProgress(msg)
      )
      finalize(files)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  const analyzeFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('File System Access API not supported. Please use Chrome or Edge.')
      return
    }
    setStatus('loading')
    setError(null)
    setGraphData(null)
    setSelectedNode(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
      setRepoName(dirHandle.name)
      setProgress('Reading files…')
      const files: Array<{ path: string; content: string }> = []
      await readFolderRecursive(dirHandle, '', files, 100, msg => setProgress(msg))
      finalize(files)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') { setStatus('idle'); return }
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [])

  const getNodeEdges = useCallback((nodeId: string) => {
    if (!graphData) return { imports: [] as string[], importedBy: [] as string[] }
    return {
      imports: graphData.edges.filter(e => e.source === nodeId).map(e => e.target),
      importedBy: graphData.edges.filter(e => e.target === nodeId).map(e => e.source),
    }
  }, [graphData])

  return {
    status, progress, error, graphData, selectedNode, repoName,
    setSelectedNode, analyzeGithub, analyzeFolder, getNodeEdges,
  }
}
