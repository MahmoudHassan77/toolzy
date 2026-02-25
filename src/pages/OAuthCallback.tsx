import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function OAuthCallback() {
  const [params] = useSearchParams()

  useEffect(() => {
    const code = params.get('code')
    if (code && window.opener) {
      window.opener.postMessage({ type: 'github-oauth-callback', code }, window.location.origin)
      window.close()
    }
  }, [params])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-fg2 text-sm">Completing sign-in... This window will close automatically.</p>
    </div>
  )
}
