import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function ImageCompressor() {
  const [original, setOriginal] = useState<{ src: string; size: number; name: string } | null>(null)
  const [compressed, setCompressed] = useState<{ src: string; size: number } | null>(null)
  const [quality, setQuality] = useState(0.7)
  const [compressing, setCompressing] = useState(false)

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      setOriginal({ src: e.target!.result as string, size: file.size, name: file.name })
      setCompressed(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  })

  function compress() {
    if (!original) return
    setCompressing(true)
    const img = new Image()
    img.src = original.src
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        blob => {
          if (!blob) { setCompressing(false); return }
          const reader = new FileReader()
          reader.onload = e => {
            setCompressed({ src: e.target!.result as string, size: blob.size })
            setCompressing(false)
          }
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        quality
      )
    }
  }

  function download() {
    if (!compressed || !original) return
    const a = document.createElement('a')
    a.href = compressed.src
    a.download = original.name.replace(/\.[^.]+$/, '') + '_compressed.jpg'
    a.click()
  }

  const saved = original && compressed ? Math.round((1 - compressed.size / original.size) * 100) : 0

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl mx-auto">
      {!original ? (
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-16 cursor-pointer transition-colors
            ${isDragActive ? 'border-acc bg-acc/5' : 'border-line hover:border-acc/50 hover:bg-raised'}`}
        >
          <input {...getInputProps()} />
          <svg className="w-10 h-10 text-fg3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-fg1">
              {isDragActive ? 'Drop image here' : 'Drop an image or click to browse'}
            </p>
            <p className="text-xs text-fg3 mt-0.5">PNG, JPG, WebP, etc.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Quality</label>
                <span className="text-sm font-mono text-fg1">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range" min={0.05} max={1} step={0.05}
                value={quality}
                onChange={e => { setQuality(Number(e.target.value)); setCompressed(null) }}
                className="w-full accent-acc"
              />
            </div>
            <button
              onClick={compress}
              disabled={compressing}
              className="px-5 py-2.5 rounded-lg bg-acc text-accon font-medium hover:bg-acch transition-colors disabled:opacity-50 shrink-0"
            >
              {compressing ? 'Compressing...' : 'Compress'}
            </button>
            <button
              onClick={() => { setOriginal(null); setCompressed(null) }}
              className="px-4 py-2.5 rounded-lg border border-line text-fg2 hover:bg-raised transition-colors text-sm shrink-0"
            >
              New File
            </button>
          </div>

          {/* Side-by-side previews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Original</span>
                <span className="text-xs text-fg2">{formatBytes(original.size)}</span>
              </div>
              <div className="rounded-lg border border-line bg-raised flex items-center justify-center p-2 min-h-48">
                <img src={original.src} alt="Original" className="max-w-full max-h-72 object-contain rounded" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Compressed</span>
                {compressed && (
                  <span className="text-xs text-fg2">
                    {formatBytes(compressed.size)}
                    {saved > 0 && (
                      <span className="ml-1 text-green-600 dark:text-green-400 font-medium">(-{saved}%)</span>
                    )}
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-line bg-raised flex items-center justify-center p-2 min-h-48">
                {compressed
                  ? <img src={compressed.src} alt="Compressed" className="max-w-full max-h-72 object-contain rounded" />
                  : <span className="text-fg3 text-sm">Click Compress to preview</span>
                }
              </div>
            </div>
          </div>

          {compressed && (
            <button
              onClick={download}
              className="self-start px-6 py-2.5 rounded-lg bg-acc text-accon font-medium hover:bg-acch transition-colors"
            >
              Download Compressed
            </button>
          )}
        </>
      )}
    </div>
  )
}
