import { useState, useCallback } from 'react'
import { TreeNode } from '../../types/fileSystem'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDirHandle = any

async function buildTree(dirHandle: AnyDirHandle): Promise<TreeNode[]> {
  const nodes: TreeNode[] = []
  for await (const entry of dirHandle.values() as AsyncIterable<FileSystemHandle>) {
    if (entry.kind === 'directory') {
      const children = await buildTree(entry as AnyDirHandle)
      nodes.push({
        name: entry.name,
        kind: 'directory',
        handle: entry as FileSystemDirectoryHandle,
        children,
      })
    } else {
      nodes.push({
        name: entry.name,
        kind: 'file',
        handle: entry as FileSystemFileHandle,
      })
    }
  }
  // Sort: directories first, then files, both alphabetically
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

export function useFolderPicker() {
  const [tree, setTree] = useState<TreeNode[] | null>(null)
  const [rootName, setRootName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('Your browser does not support the File System Access API. Please use Chrome or Edge.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
      setRootName(dirHandle.name)
      const nodes = await buildTree(dirHandle)
      setTree(nodes)
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { tree, rootName, loading, error, pickFolder }
}
