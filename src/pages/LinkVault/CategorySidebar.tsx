interface Props {
  categories: Map<string, number>
  selected: string | null
  onSelect: (cat: string | null) => void
  totalCount: number
}

export default function CategorySidebar({ categories, selected, onSelect, totalCount }: Props) {
  const sorted = Array.from(categories.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-48 shrink-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-fg3 mb-2">Categories</h3>
        <button
          onClick={() => onSelect(null)}
          className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
            selected === null ? 'bg-acc/15 text-acc font-medium' : 'text-fg2 hover:text-fg1 hover:bg-raised'
          }`}
        >
          All <span className="text-fg3 ml-1">({totalCount})</span>
        </button>
        {sorted.map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
              selected === cat ? 'bg-acc/15 text-acc font-medium' : 'text-fg2 hover:text-fg1 hover:bg-raised'
            }`}
          >
            {cat} <span className="text-fg3 ml-1">({count})</span>
          </button>
        ))}
      </aside>

      {/* Mobile pills */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          onClick={() => onSelect(null)}
          className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
            selected === null
              ? 'border-acc bg-acc/15 text-acc font-medium'
              : 'border-line text-fg2 hover:border-acc/40'
          }`}
        >
          All ({totalCount})
        </button>
        {sorted.map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
              selected === cat
                ? 'border-acc bg-acc/15 text-acc font-medium'
                : 'border-line text-fg2 hover:border-acc/40'
            }`}
          >
            {cat} ({count})
          </button>
        ))}
      </div>
    </>
  )
}
