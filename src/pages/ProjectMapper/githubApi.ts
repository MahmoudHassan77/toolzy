interface GithubTreeItem {
  path: string
  type: 'blob' | 'tree'
}

export interface FetchedFile {
  path: string
  content: string
}

const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte', '.astro',
  '.py', '.go', '.rs', '.java', '.cpp', '.c', '.cs', '.h',
  '.rb', '.php', '.swift', '.kt', '.r', '.scala',
  '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml',
])

function isSourceFile(path: string): boolean {
  const dot = path.lastIndexOf('.')
  return dot !== -1 && SOURCE_EXTS.has(path.slice(dot).toLowerCase())
}

function shouldSkip(path: string): boolean {
  return (
    path.includes('node_modules/') ||
    path.includes('.git/') ||
    path.includes('dist/') ||
    path.includes('build/') ||
    path.includes('.next/') ||
    path.includes('__pycache__/') ||
    path.includes('vendor/') ||
    path.includes('coverage/') ||
    path.startsWith('.')
  )
}

export function parseGithubUrl(url: string): {
  owner: string; repo: string; branch: string
} | null {
  try {
    const u = new URL(url.trim().replace(/\/$/, ''))
    if (!u.hostname.includes('github.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0]
    const repo = parts[1].replace(/\.git$/, '')
    let branch = 'main'
    if (parts[2] === 'tree' && parts[3]) {
      branch = parts.slice(3).join('/')
    }
    return { owner, repo, branch }
  } catch {
    return null
  }
}

export async function fetchGithubFiles(
  owner: string,
  repo: string,
  branch: string,
  onProgress?: (msg: string) => void,
  maxFiles = 80
): Promise<FetchedFile[]> {
  onProgress?.(`Fetching file tree for ${owner}/${repo}@${branch}…`)

  // Try specified branch, fallback to master
  let treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  )
  if (!treeRes.ok && branch === 'main') {
    branch = 'master'
    treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    )
  }
  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `GitHub API error ${treeRes.status}`)
  }

  const data = await treeRes.json() as { tree?: GithubTreeItem[]; truncated?: boolean }
  const items = (data.tree ?? [])
    .filter(i => i.type === 'blob' && isSourceFile(i.path) && !shouldSkip(i.path))
    .slice(0, maxFiles)

  onProgress?.(`Found ${items.length} source files. Fetching contents…`)

  const files: FetchedFile[] = []
  const BATCH = 10

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      batch.map(async item => {
        const rawUrl =
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`
        const r = await fetch(rawUrl)
        if (!r.ok) return null
        return { path: item.path, content: await r.text() }
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) files.push(r.value)
    }
    onProgress?.(
      `Loaded ${Math.min(i + BATCH, items.length)} / ${items.length} files…`
    )
  }

  return files
}
