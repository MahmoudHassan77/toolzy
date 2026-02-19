import { useState } from 'react'
import { useFolderPicker } from './useFolderPicker'
import FolderTree from './FolderTree'
import MarkdownViewer from './MarkdownViewer'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

const isSupported = 'showDirectoryPicker' in window

export default function InterviewBrowser() {
  const { tree, rootName, loading, error, pickFolder } = useFolderPicker()
  const [selectedFile, setSelectedFile] = useState<FileSystemFileHandle | null>(null)

  if (!isSupported) {
    return (
      <div className="p-8 flex flex-col items-center gap-4 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="text-xl font-semibold text-fg1">Browser Not Supported</h2>
        <p className="text-fg2 max-w-md text-sm">
          The File System Access API is required for this feature. Please use{' '}
          <strong className="text-fg1">Chrome</strong> or <strong className="text-fg1">Edge</strong> (version 86+).
          Firefox and Safari are not supported.
        </p>
      </div>
    )
  }

  if (!tree) {
    return (
      <div className="p-8 flex flex-col items-center gap-6 text-center">
        <div className="text-5xl">📁</div>
        <div>
          <h2 className="text-xl font-semibold text-fg1 mb-1">Interview Questions Browser</h2>
          <p className="text-fg2 text-sm max-w-sm">
            Pick a folder on your computer containing markdown files to browse your interview prep notes.
          </p>
        </div>
        {error && (
          <p className="text-red-500 text-sm bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}
        <Button onClick={pickFolder} disabled={loading} size="lg">
          {loading ? <Spinner size="sm" /> : null}
          {loading ? 'Opening...' : 'Open Folder'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 border-r border-line bg-surface flex flex-col h-full overflow-hidden">
        <div className="px-3 py-2 border-b border-line flex items-center justify-between">
          <span className="text-xs text-fg3">{tree.length} items</span>
          <Button variant="ghost" size="sm" onClick={pickFolder}>Re-open Folder</Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <FolderTree tree={tree} rootName={rootName} onSelect={setSelectedFile} selectedHandle={selectedFile} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-surface h-full">
        {selectedFile ? (
          <MarkdownViewer key={selectedFile.name} fileHandle={selectedFile} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-fg3 gap-2">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Select a file to preview</p>
          </div>
        )}
      </div>
    </div>
  )
}
