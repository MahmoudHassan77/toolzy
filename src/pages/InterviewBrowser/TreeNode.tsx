import { useState } from 'react'
import { TreeNode as TreeNodeType } from '../../types/fileSystem'

interface TreeNodeProps {
  node: TreeNodeType
  depth: number
  search: string
  onSelect: (handle: FileSystemFileHandle) => void
  selectedHandle: FileSystemFileHandle | null
}

function nodeMatchesSearch(node: TreeNodeType, search: string): boolean {
  if (!search) return true
  if (node.name.toLowerCase().includes(search.toLowerCase())) return true
  if (node.children) return node.children.some((child) => nodeMatchesSearch(child, search))
  return false
}

export default function TreeNode({ node, depth, search, onSelect, selectedHandle }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2 || !!search)

  if (!nodeMatchesSearch(node, search)) return null

  if (node.kind === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-sm text-fg2 hover:bg-raised hover:text-acc transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <svg className={`w-3.5 h-3.5 text-fg3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-acc shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode key={child.name} node={child} depth={depth + 1} search={search} onSelect={onSelect} selectedHandle={selectedHandle} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isSelected = selectedHandle === node.handle
  const isMarkdown = node.name.match(/\.(md|markdown|txt)$/i)

  return (
    <button
      onClick={() => onSelect(node.handle as FileSystemFileHandle)}
      className={`flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-sm transition-colors truncate
        ${isSelected ? 'bg-acc/20 text-acc' : 'text-fg2 hover:bg-raised hover:text-fg1'}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <svg className={`w-4 h-4 shrink-0 ${isMarkdown ? 'text-acc' : 'text-fg3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="truncate">{node.name}</span>
    </button>
  )
}
