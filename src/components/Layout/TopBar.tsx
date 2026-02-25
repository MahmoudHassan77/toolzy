import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'

const titles: Record<string, string> = {
  '/dashboard':                 'Dashboard',
  '/dashboard/browser':          'Interview Questions Browser',
  '/dashboard/tracker':          'Interview Tracker',
  '/dashboard/pdf-editor':       'PDF Editor',
  '/dashboard/pdf-to-word':      'PDF to Word',
  '/dashboard/md-editor':        'Markdown Editor',
  '/dashboard/json':             'JSON Formatter',
  '/dashboard/diff':             'Diff Viewer',
  '/dashboard/encoder':          'Base64 / URL Encoder',
  '/dashboard/regex':            'Regex Tester',
  '/dashboard/pomodoro':         'Pomodoro Timer',
  '/dashboard/notes':            'Notes',
  '/dashboard/todo':             'Todo List',
  '/dashboard/image-compressor': 'Image Compressor',
  '/dashboard/csv':              'CSV Viewer',
  '/dashboard/qr':               'QR Code Generator',
  '/dashboard/colors':           'Color Palette',
  '/dashboard/base64-image':     'Base64 to Image',
  '/dashboard/diagram':          'Diagram Editor',
  '/dashboard/project-mapper':   'Project File Map',
  '/dashboard/storyboard':       'Story Board',
  '/dashboard/calendar':         'Calendar',
}

interface TopBarProps {
  onMenuClick: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const title = titles[pathname] ?? 'Toolzy'
  const { isDark, toggle } = useTheme()
  const { user, isAuthenticated, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/')
  }

  return (
    <header className="h-14 bg-surface border-b border-line flex items-center px-4 shrink-0 gap-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-fg2 hover:bg-raised hover:text-fg1 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-base font-semibold text-fg1 flex-1 truncate">{title}</h1>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-fg2 hover:bg-raised hover:text-fg1 transition-colors shrink-0"
      >
        {isDark ? (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>

      {/* Auth section */}
      {isAuthenticated && user ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-raised transition-colors"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-acc text-accon flex items-center justify-center text-xs font-bold">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span className="text-sm font-medium text-fg1 hidden sm:block max-w-[100px] truncate">{user.name}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-line rounded-lg shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-line">
                <p className="text-xs font-medium text-fg1 truncate">{user.name}</p>
                <p className="text-[10px] text-fg3 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-fg2 hover:bg-raised hover:text-fg1 transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => navigate('/login')}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-acc text-accon hover:opacity-90 transition-opacity shrink-0"
        >
          Sign In
        </button>
      )}
    </header>
  )
}
