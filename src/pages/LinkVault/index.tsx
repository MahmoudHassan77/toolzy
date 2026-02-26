import { useState, useMemo } from 'react'
import { useLinks } from './useLinks'
import type { LinkItem } from './types'
import AddLinkForm from './AddLinkForm'
import LinkCard from './LinkCard'
import EditLinkModal from './EditLinkModal'
import CategorySidebar from './CategorySidebar'

export default function LinkVault() {
  const { links, categories, addLink, updateLink, deleteLink } = useLinks()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null)

  const existingCategories = useMemo(() => Array.from(categories.keys()), [categories])

  const filtered = useMemo(() => {
    let result = links
    if (selectedCategory) {
      result = result.filter(l => l.category === selectedCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return result
  }, [links, selectedCategory, search])

  function handleAdd(data: Omit<LinkItem, 'id' | 'createdAt' | 'updatedAt'>) {
    addLink(data)
    setShowAddForm(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-line">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-fg1">Link Vault</h1>
            <p className="text-xs text-fg2 mt-0.5">Save and organize your bookmarks</p>
          </div>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg bg-acc text-white hover:bg-acc/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Link
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search links by title, URL, description, or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-line bg-raised text-sm text-fg1 placeholder:text-fg3 focus:outline-none focus:border-acc transition-colors"
          />
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="shrink-0 px-6 pt-4">
          <AddLinkForm
            existingCategories={existingCategories}
            onAdd={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Main area: sidebar + grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {categories.size > 0 && (
            <CategorySidebar
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              totalCount={links.length}
            />
          )}

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="w-12 h-12 text-fg3 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <p className="text-sm text-fg2">
                  {links.length === 0
                    ? 'No links yet. Click "Add Link" to get started!'
                    : 'No links match your search.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(link => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    onEdit={setEditingLink}
                    onDelete={deleteLink}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingLink && (
        <EditLinkModal
          link={editingLink}
          existingCategories={existingCategories}
          onSave={updateLink}
          onClose={() => setEditingLink(null)}
        />
      )}
    </div>
  )
}
