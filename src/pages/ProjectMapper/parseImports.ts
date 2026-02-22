const PATTERNS = [
  // ES6: import X from './path' / export { X } from './path'
  /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  // CommonJS: require('./path')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Dynamic: import('./path')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

/** Extract all relative import paths (starting with ./ or ../) from file content */
export function extractRelativeImports(content: string): string[] {
  const found = new Set<string>()
  for (const re of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      if (m[1].startsWith('.')) found.add(m[1])
    }
  }
  return [...found]
}

/**
 * Resolve a relative import path to a normalized absolute path.
 * e.g. sourceFile="src/pages/Home.tsx", importPath="./utils/foo"
 *   → "src/pages/utils/foo"
 */
export function resolveImport(sourceFile: string, importPath: string): string {
  const parts = sourceFile.split('/').slice(0, -1)
  for (const seg of importPath.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

/** Find the actual file path from a resolved (possibly extension-less) path */
export function findFile(resolved: string, knownFiles: Set<string>): string | null {
  if (knownFiles.has(resolved)) return resolved

  const exts = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.go',
    '.rs', '.css', '.scss', '.json', '.yaml', '.yml']

  for (const ext of exts) {
    if (knownFiles.has(resolved + ext)) return resolved + ext
  }
  for (const ext of exts) {
    const idx = resolved + '/index' + ext
    if (knownFiles.has(idx)) return idx
  }
  return null
}
