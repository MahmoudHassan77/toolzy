import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

interface Swatch {
  hex: string
  savedAt: number
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export default function ColorPalette() {
  const [color, setColor] = useState('#f59e0b')
  const [palette, setPalette] = useLocalStorage<Swatch[]>('toolzy-palette', [])
  const [copied, setCopied] = useState('')

  const rgb = hexToRgb(color)
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null

  function save() {
    if (palette.find(s => s.hex.toLowerCase() === color.toLowerCase())) return
    setPalette(prev => [{ hex: color.toUpperCase(), savedAt: Date.now() }, ...prev])
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(''), 1500)
  }

  function removeSwatch(hex: string) {
    setPalette(prev => prev.filter(s => s.hex !== hex))
  }

  const hexUpper = color.toUpperCase()

  return (
    <div className="p-6 flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Picker card */}
      <div className="rounded-xl border border-line bg-surface p-5 flex flex-col gap-4">
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-xl border-2 border-line shadow-sm shrink-0 transition-colors"
            style={{ background: color }}
          />
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Pick Color</label>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-bg cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={hexUpper}
              onChange={e => {
                const v = e.target.value
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v.length === 7 ? v : color)
              }}
              maxLength={7}
              className="rounded-lg border border-line bg-bg px-3 py-1.5 font-mono text-sm text-fg1 outline-none focus:border-acc"
              placeholder="#F59E0B"
            />
          </div>
        </div>

        {rgb && hsl && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'HEX', value: hexUpper },
              { label: 'RGB', value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
              { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
            ].map(({ label, value }) => (
              <button
                key={label}
                onClick={() => copyText(value)}
                className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border border-line bg-bg hover:border-acc transition-colors text-left"
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">{label}</span>
                <span className="text-xs font-mono text-fg1 truncate">{value}</span>
                {copied === value && <span className="text-[10px] text-acc">Copied!</span>}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={save}
          className="self-start px-5 py-2 rounded-lg bg-acc text-accon text-sm font-medium hover:bg-acch transition-colors"
        >
          Save to Palette
        </button>
      </div>

      {/* Saved palette */}
      {palette.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">
              Saved Palette ({palette.length})
            </span>
            <button onClick={() => setPalette([])} className="text-xs text-fg3 hover:text-fg1 transition-colors">
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {palette.map(s => (
              <div key={s.hex} className="group relative flex flex-col items-center gap-1">
                <button
                  onClick={() => setColor(s.hex)}
                  className="w-12 h-12 rounded-xl border-2 border-line hover:border-acc transition-colors shadow-sm"
                  style={{ background: s.hex }}
                  title={s.hex}
                />
                <span className="text-[10px] font-mono text-fg3">{s.hex}</span>
                <button
                  onClick={() => removeSwatch(s.hex)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] items-center justify-center hidden group-hover:flex leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
