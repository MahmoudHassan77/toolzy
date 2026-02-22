import { useState, useEffect } from 'react'

function b64url(str: string): string {
  // Add padding and convert base64url → base64
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + (4 - (str.length % 4)) % 4, '='
  )
  try {
    return decodeURIComponent(
      atob(padded).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
    )
  } catch {
    return ''
  }
}

function tryParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

const ALGO_COLORS: Record<string, string> = {
  HS256: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  HS384: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  HS512: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  RS256: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  RS384: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  RS512: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  ES256: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  ES384: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  ES512: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
}

function useCountdown(exp: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!exp) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [exp])
  if (!exp) return null
  return Math.floor(exp * 1000) - now  // ms remaining (negative = expired)
}

function ExpiryBadge({ exp }: { exp: number }) {
  const ms = useCountdown(exp)
  if (ms === null) return null
  const expired = ms <= 0
  const abs = Math.abs(ms)
  const h   = Math.floor(abs / 3_600_000)
  const m   = Math.floor((abs % 3_600_000) / 60_000)
  const s   = Math.floor((abs % 60_000) / 1_000)
  const fmt = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      expired
        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${expired ? 'bg-red-500' : 'bg-green-500'}`} />
      {expired ? `Expired ${fmt} ago` : `Expires in ${fmt}`}
    </span>
  )
}

function JsonBlock({ label, color, data }: { label: string; color: string; data: unknown }) {
  const [copied, setCopied] = useState(false)
  const text = formatJson(data)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${color}`}>
          {label}
        </span>
        <button
          onClick={copy}
          className="text-[10px] text-fg3 hover:text-fg1 transition-colors ml-auto"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-raised rounded-lg p-4 text-xs font-mono text-fg1 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
        {text}
      </pre>
    </div>
  )
}

function ClaimRow({ name, value }: { name: string; value: unknown }) {
  const ts  = (typeof value === 'number' && value > 1_000_000_000 && value < 9_999_999_999)
    ? new Date(value * 1000).toLocaleString()
    : null

  const knownClaims: Record<string, string> = {
    sub: 'Subject',  iss: 'Issuer',   aud: 'Audience',
    exp: 'Expires',  iat: 'Issued At', nbf: 'Not Before',
    jti: 'JWT ID',
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-4 align-top">
        <span className="text-xs font-mono font-semibold text-acc">{name}</span>
        {knownClaims[name] && (
          <div className="text-[10px] text-fg3">{knownClaims[name]}</div>
        )}
      </td>
      <td className="py-2 align-top">
        <span className="text-xs font-mono text-fg1 break-all">
          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </span>
        {ts && <div className="text-[10px] text-fg3 mt-0.5">{ts}</div>}
        {name === 'exp' && typeof value === 'number' && <div className="mt-1"><ExpiryBadge exp={value} /></div>}
      </td>
    </tr>
  )
}

const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

export default function JwtDecoder() {
  const [token, setToken] = useState('')

  const parts = token.trim().split('.')
  const valid = parts.length === 3

  const header  = valid ? tryParse(b64url(parts[0])) : null
  const payload = valid ? tryParse(b64url(parts[1])) : null

  const alg     = header && typeof header === 'object' && 'alg' in header
    ? String((header as Record<string,unknown>).alg)
    : null
  const exp     = payload && typeof payload === 'object' && 'exp' in payload
    ? (payload as Record<string,unknown>).exp as number
    : null

  const payloadClaims = payload && typeof payload === 'object'
    ? Object.entries(payload as Record<string, unknown>)
    : []

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Input ── */}
      <div className="bg-surface border-b border-line px-4 py-3 shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">JWT Token</span>
          {alg && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${ALGO_COLORS[alg] ?? 'bg-surface border border-line text-fg2'}`}>
              {alg}
            </span>
          )}
          {exp !== null && <ExpiryBadge exp={exp} />}
          <button
            onClick={() => setToken(SAMPLE)}
            className="ml-auto text-xs text-fg3 hover:text-acc transition-colors"
          >
            Load sample
          </button>
          {token && (
            <button onClick={() => setToken('')} className="text-xs text-fg3 hover:text-red-400 transition-colors">
              Clear
            </button>
          )}
        </div>

        <textarea
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Paste a JWT token here…"
          rows={3}
          spellCheck={false}
          className="w-full px-3 py-2 text-xs font-mono rounded border border-line bg-raised text-fg1 placeholder-fg3 focus:outline-none focus:border-acc resize-y"
          style={{ wordBreak: 'break-all' }}
        />

        {token && !valid && (
          <p className="text-xs text-red-500">
            Invalid JWT — a valid token has exactly 3 parts separated by dots.
          </p>
        )}
      </div>

      {/* ── Decoded output ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {!token && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-fg3">
            <svg viewBox="0 0 48 48" className="w-12 h-12 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="8" y="4" width="32" height="40" rx="3" />
              <path d="M16 14h16M16 20h16M16 26h10" strokeLinecap="round" />
              <circle cx="34" cy="36" r="8" fill="var(--surface)" />
              <path d="M31 36l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-medium">Paste a JWT token to decode it</p>
            <p className="text-xs opacity-60">Everything is decoded locally — nothing is sent to any server</p>
          </div>
        )}

        {valid && !!header && !!payload && (
          <div className="max-w-3xl mx-auto flex flex-col gap-6">

            {/* Token parts visual */}
            <div className="font-mono text-xs break-all leading-relaxed">
              <span className="text-red-500">{parts[0]}</span>
              <span className="text-fg3">.</span>
              <span className="text-purple-500">{parts[1]}</span>
              <span className="text-fg3">.</span>
              <span className="text-blue-500">{parts[2]}</span>
            </div>

            {/* Header + Payload JSON */}
            <JsonBlock label="Header"  color="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"     data={header} />
            <JsonBlock label="Payload" color="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" data={payload} />

            {/* Signature note */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 w-fit">
                Signature
              </span>
              <p className="text-xs text-fg3 bg-raised rounded-lg px-4 py-3">
                <span className="font-mono text-blue-500">{parts[2]}</span>
                <br /><br />
                Signature verification requires the secret key and cannot be done client-side for HMAC algorithms.
                For RS/ES algorithms the public key would be needed.
              </p>
            </div>

            {/* Claims table */}
            {payloadClaims.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Claims</span>
                <div className="bg-raised rounded-lg px-4">
                  <table className="w-full">
                    <tbody>
                      {payloadClaims.map(([k, v]) => (
                        <ClaimRow key={k} name={k} value={v} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
