import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function QrGenerator() {
  const [text, setText] = useState('https://toolzyhub.netlify.app/')
  const [size, setSize] = useState(256)
  const [dataUrl, setDataUrl] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      if (!text.trim()) { setDataUrl(''); return }
      try {
        const url = await QRCode.toDataURL(text, {
          width: size,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        })
        setDataUrl(url)
      } catch {
        setDataUrl('')
      }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [text, size])

  function download() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'qrcode.png'
    a.click()
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-xl mx-auto">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Content</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="Enter URL, text, contact info, or any content..."
          className="resize-none rounded-lg border border-line bg-bg p-3 text-sm text-fg1 outline-none focus:border-acc"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">
          Size: {size}px
        </label>
        <input
          type="range" min={128} max={512} step={32}
          value={size}
          onChange={e => setSize(Number(e.target.value))}
          className="w-full accent-acc"
        />
        <div className="flex justify-between text-[10px] text-fg3">
          <span>128px</span><span>512px</span>
        </div>
      </div>

      {dataUrl ? (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
            <img src={dataUrl} alt="QR Code" width={size} height={size} className="block" />
          </div>
          <button
            onClick={download}
            className="px-6 py-2.5 rounded-lg bg-acc text-accon font-medium hover:bg-acch transition-colors"
          >
            Download PNG
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 rounded-xl border border-dashed border-line text-fg3 text-sm">
          Enter content above to generate QR code
        </div>
      )}
    </div>
  )
}
