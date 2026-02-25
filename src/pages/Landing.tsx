import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const FREE_TOOLS = [
  { name: 'Base64/URL Encoder', path: 'encoder', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  { name: 'Regex Tester', path: 'regex', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { name: 'JSON Formatter', path: 'json', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  { name: 'QR Code', path: 'qr', icon: 'M12 4h.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm8 4h.01M16 16h4v4h-4v-4zM8 8h.01M16 8h.01M8 16h.01' },
  { name: 'Color Palette', path: 'colors', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { name: 'Base64 Image', path: 'base64-image', icon: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' },
  { name: 'CSV Viewer', path: 'csv', icon: 'M3 10h18M3 14h18M3 6h18M3 18h18' },
  { name: 'Diff Viewer', path: 'diff', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { name: 'Pomodoro', path: 'pomodoro', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Notes', path: 'notes', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5-9 9H7v-5L16 3z' },
  { name: 'Todo List', path: 'todo', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h3m-3 4h3m2-4h.01M16 16h.01' },
  { name: 'Image Compressor', path: 'image-compressor', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { name: 'Markdown Editor', path: 'md-editor', icon: 'M4 6h16M4 12h10m-10 6h16' },
]

const PREMIUM_TOOLS = [
  { name: 'PDF Editor', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { name: 'PDF to Word', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2' },
  { name: 'Diagram Editor', icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
  { name: 'Story Board', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
  { name: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { name: 'Project Mapper', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4zM9 10h6M12 7v6' },
  { name: 'File Browser', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { name: 'Tracker', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
]

const FEATURES = [
  { title: 'Document Tools', desc: 'PDF editing, conversion, and annotation', color: 'from-orange-500 to-red-500' },
  { title: 'Code Utilities', desc: 'JSON, regex, encoding, and diff tools', color: 'from-emerald-500 to-teal-500' },
  { title: 'Productivity', desc: 'Kanban boards, timers, notes, and todos', color: 'from-violet-500 to-purple-500' },
  { title: 'Developer Tools', desc: 'Diagrams, project mapping, and more', color: 'from-blue-500 to-indigo-500' },
  { title: 'Media', desc: 'Image compression, QR codes, and colors', color: 'from-pink-500 to-rose-500' },
  { title: 'Cloud Sync', desc: 'Sign in to sync your data across devices', color: 'from-cyan-500 to-sky-500' },
]

function SvgIcon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-bg text-fg1">
      {/* Header */}
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-acc font-bold text-lg tracking-tight">Toolzy</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-fg2 hover:text-acc transition-colors"
            >
              Tools
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-fg2 hover:text-acc transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-acc text-accon hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Your all-in-one <span className="text-acc">productivity toolkit</span>
          </h1>
          <p className="mt-4 text-lg text-fg2 max-w-xl mx-auto">
            19 tools for documents, code, project management, and more. Free tools work instantly — sign in to unlock premium features and cloud sync.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 rounded-lg bg-acc text-accon font-medium hover:opacity-90 transition-opacity"
            >
              Open Free Tools
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-2.5 rounded-lg border border-line text-fg1 font-medium hover:bg-surface transition-colors"
            >
              Create Account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 rounded-lg border border-line text-fg2 font-medium hover:bg-surface hover:text-fg1 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 border-t border-line">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Everything you need in one place</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
                <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${f.color} mb-3`}>
                  <div className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm">{f.title}</h3>
                <p className="mt-1 text-xs text-fg2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Tools */}
      <section className="py-16 px-6 border-t border-line">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Free Tools</h2>
            <p className="mt-2 text-sm text-fg2">No account needed — use these tools right away</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {FREE_TOOLS.map(t => (
              <button
                key={t.name}
                onClick={() => navigate(`/dashboard/${t.path}`)}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 hover:border-acc/50 hover:shadow-sm transition-all text-left"
              >
                <span className="text-acc shrink-0"><SvgIcon d={t.icon} /></span>
                <span className="text-xs font-medium truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Tools */}
      <section className="py-16 px-6 border-t border-line">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Premium Tools</h2>
            <p className="mt-2 text-sm text-fg2">Sign in to unlock powerful tools with cloud sync</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {PREMIUM_TOOLS.map(t => (
              <div key={t.name} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 opacity-75">
                <span className="text-fg3 shrink-0"><SvgIcon d={t.icon} /></span>
                <span className="text-xs font-medium truncate">{t.name}</span>
                <svg className="w-3.5 h-3.5 text-fg3 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-line text-center">
        <span className="text-xs text-fg3">Toolzy — Built with React + TypeScript</span>
      </footer>
    </div>
  )
}
