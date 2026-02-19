import { useState } from 'react'
import { TreeNode as TreeNodeType } from '../../types/fileSystem'
import TreeNode from './TreeNode'
import Input from '../../components/ui/Input'

interface FolderTreeProps {
  tree: TreeNodeType[]
  rootName: string
  onSelect: (handle: FileSystemFileHandle) => void
  selectedHandle: FileSystemFileHandle | null
}

export default function FolderTree({ tree, rootName, onSelect, selectedHandle }: FolderTreeProps) {
  const [search, setSearch] = useState('')

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-line">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-acc" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-sm font-semibold text-fg1 truncate">{rootName}</span>
        </div>
        <Input
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {tree.map((node) => (
          <TreeNode key={node.name} node={node} depth={0} search={search} onSelect={onSelect} selectedHandle={selectedHandle} />
        ))}
      </div>
    </div>
  )
}
