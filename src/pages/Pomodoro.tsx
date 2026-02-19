import { useState, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

interface Session {
  type: 'work' | 'break'
  completedAt: number
}

const WORK_SECS = 25 * 60
const BREAK_SECS = 5 * 60

export default function Pomodoro() {
  const [mode, setMode] = useState<'work' | 'break'>('work')
  const [seconds, setSeconds] = useState(WORK_SECS)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useLocalStorage<Session[]>('toolzy-pomodoro-log', [])

  const total = mode === 'work' ? WORK_SECS : BREAK_SECS
  const pct = ((total - seconds) / total) * 100
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
      setSeconds(next === 'work' ? WORK_SECS : BREAK_SECS)
    }
  }, [running, seconds, mode, setLog])

  function switchMode(m: 'work' | 'break') {
    setRunning(false)
    setMode(m)
    setSeconds(m === 'work' ? WORK_SECS : BREAK_SECS)
  }

  function reset() {
    setRunning(false)
    setSeconds(mode === 'work' ? WORK_SECS : BREAK_SECS)
  }

  function skip() {
    const next: 'work' | 'break' = mode === 'work' ? 'break' : 'work'
    setRunning(false)
    setMode(next)
    setSeconds(next === 'work' ? WORK_SECS : BREAK_SECS)
  }

  const radius = 88
  const circumference = 2 * Math.PI * radius
  const strokeOffset = circumference * (1 - pct / 100)

  return (
    <div className="p-6 max-w-lg mx-auto flex flex-col gap-8">
      {/* Mode switcher */}
      <div className="flex items-center justify-center gap-2">
        {(['work', 'break'] as const).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`px-5 py-2 text-sm rounded-lg font-medium transition-colors
              ${mode === m ? 'bg-acc text-accon' : 'bg-raised text-fg2 hover:bg-line'}`}
          >
            {m === 'work' ? 'Work (25m)' : 'Break (5m)'}
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
