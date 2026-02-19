import { useState, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

interface Session {
  type: 'work' | 'break'
  completedAt: number
}

interface Settings {
  workMins: number
  breakMins: number
}

const DEFAULT_SETTINGS: Settings = { workMins: 25, breakMins: 5 }

export default function Pomodoro() {
  const [settings, setSettings] = useLocalStorage<Settings>('toolzy-pomodoro-settings', DEFAULT_SETTINGS)
  const [mode, setMode] = useState<'work' | 'break'>('work')
  const [seconds, setSeconds] = useState(settings.workMins * 60)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useLocalStorage<Session[]>('toolzy-pomodoro-log', [])

  const total = mode === 'work' ? settings.workMins * 60 : settings.breakMins * 60
  const pct = total > 0 ? ((total - seconds) / total) * 100 : 0
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  // Update browser tab title while running
  useEffect(() => {
    if (running) document.title = `${mm}:${ss} — Pomodoro`
    return () => { document.title = 'Toolzy' }
  }, [running, mm, ss])

  // Countdown tick
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  // Handle session completion
  useEffect(() => {
    if (running && seconds === 0) {
      setLog(prev => [...prev, { type: mode, completedAt: Date.now() }])
      const next: 'work' | 'break' = mode === 'work' ? 'break' : 'work'
      setRunning(false)
      setMode(next)
      setSeconds(next === 'work' ? settings.workMins * 60 : settings.breakMins * 60)
    }
  }, [running, seconds, mode, settings, setLog])

  function switchMode(m: 'work' | 'break') {
    setRunning(false)
    setMode(m)
    setSeconds(m === 'work' ? settings.workMins * 60 : settings.breakMins * 60)
  }

  function reset() {
    setRunning(false)
    setSeconds(mode === 'work' ? settings.workMins * 60 : settings.breakMins * 60)
  }

  function skip() {
    const next: 'work' | 'break' = mode === 'work' ? 'break' : 'work'
    setRunning(false)
    setMode(next)
    setSeconds(next === 'work' ? settings.workMins * 60 : settings.breakMins * 60)
  }

  function handleSettingChange(key: keyof Settings, raw: string) {
    const val = Math.max(1, Math.min(120, parseInt(raw) || 1))
    const next = { ...settings, [key]: val }
    setSettings(next)
    // If not running, sync the current timer immediately
    if (!running) {
      const newSecs = mode === 'work' ? next.workMins * 60 : next.breakMins * 60
      setSeconds(newSecs)
    }
  }

  const radius = 88
  const circumference = 2 * Math.PI * radius
  const strokeOffset = circumference * (1 - pct / 100)

  return (
    <div className="p-6 max-w-lg mx-auto flex flex-col gap-6">
      {/* Duration settings */}
      <div className="rounded-xl border border-line bg-surface p-4 flex items-center gap-6 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest text-fg3 shrink-0">Duration</span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-fg2 shrink-0">Work</label>
          <div className="flex items-center rounded-lg border border-line bg-bg overflow-hidden">
            <button
              type="button"
              onClick={() => handleSettingChange('workMins', String(settings.workMins - 1))}
              disabled={running || settings.workMins <= 1}
              className="w-8 h-8 flex items-center justify-center text-fg2 hover:text-fg1 hover:bg-raised transition-colors disabled:opacity-30 text-base font-bold"
            >−</button>
            <span className="w-8 text-center text-sm font-mono text-fg1 tabular-nums select-none">
              {settings.workMins}
            </span>
            <button
              type="button"
              onClick={() => handleSettingChange('workMins', String(settings.workMins + 1))}
              disabled={running || settings.workMins >= 120}
              className="w-8 h-8 flex items-center justify-center text-fg2 hover:text-fg1 hover:bg-raised transition-colors disabled:opacity-30 text-base font-bold"
            >+</button>
            <span className="pr-2 pl-1 text-xs text-fg3">min</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-fg2 shrink-0">Break</label>
          <div className="flex items-center rounded-lg border border-line bg-bg overflow-hidden">
            <button
              type="button"
              onClick={() => handleSettingChange('breakMins', String(settings.breakMins - 1))}
              disabled={running || settings.breakMins <= 1}
              className="w-8 h-8 flex items-center justify-center text-fg2 hover:text-fg1 hover:bg-raised transition-colors disabled:opacity-30 text-base font-bold"
            >−</button>
            <span className="w-8 text-center text-sm font-mono text-fg1 tabular-nums select-none">
              {settings.breakMins}
            </span>
            <button
              type="button"
              onClick={() => handleSettingChange('breakMins', String(settings.breakMins + 1))}
              disabled={running || settings.breakMins >= 60}
              className="w-8 h-8 flex items-center justify-center text-fg2 hover:text-fg1 hover:bg-raised transition-colors disabled:opacity-30 text-base font-bold"
            >+</button>
            <span className="pr-2 pl-1 text-xs text-fg3">min</span>
          </div>
        </div>
        {running && (
          <span className="text-xs text-fg3 ml-auto">Stop timer to edit</span>
        )}
      </div>

      {/* Mode switcher */}
      <div className="flex items-center justify-center gap-2">
        {(['work', 'break'] as const).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`px-5 py-2 text-sm rounded-lg font-medium transition-colors
              ${mode === m ? 'bg-acc text-accon' : 'bg-raised text-fg2 hover:bg-line'}`}
          >
            {m === 'work' ? `Work (${settings.workMins}m)` : `Break (${settings.breakMins}m)`}
          </button>
        ))}
      </div>

      {/* Circular timer */}
      <div className="flex justify-center">
        <div className="relative w-56 h-56">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
            <circle
              cx="100" cy="100" r={radius}
              fill="none" stroke="var(--acc)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              style={{ transition: 'stroke-dashoffset 0.9s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-fg1 tabular-nums">{mm}:{ss}</span>
            <span className="text-xs text-fg3 mt-1">{mode === 'work' ? 'Focus time' : 'Break time'}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3">
        <button
          onClick={() => setRunning(r => !r)}
          className="px-8 py-2.5 rounded-lg bg-acc text-accon font-medium hover:bg-acch transition-colors"
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2.5 rounded-lg border border-line text-fg2 hover:bg-raised transition-colors text-sm"
        >
          Reset
        </button>
        <button
          onClick={skip}
          className="px-4 py-2.5 rounded-lg border border-line text-fg2 hover:bg-raised transition-colors text-sm"
        >
          Skip
        </button>
      </div>

      {/* Session log */}
      {log.length > 0 && (
        <div className="rounded-lg border border-line bg-surface">
          <div className="px-4 py-2 border-b border-line flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">
              Session Log ({log.length})
            </span>
            <button onClick={() => setLog([])} className="text-xs text-fg3 hover:text-fg1 transition-colors">
              Clear
            </button>
          </div>
          <div className="divide-y divide-line max-h-52 overflow-y-auto">
            {[...log].reverse().map((s, i) => (
              <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className={s.type === 'work' ? 'text-acc font-medium' : 'text-fg2'}>
                  {s.type === 'work' ? '🍅 Work session' : '☕ Break'}
                </span>
                <span className="text-fg3 text-xs">
                  {new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
