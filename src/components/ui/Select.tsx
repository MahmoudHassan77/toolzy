import { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  wrapperClassName?: string
}

export default function Select({ label, error, options, wrapperClassName = '', className = '', id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={`flex flex-col gap-1 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-fg1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`rounded-md border px-3 py-2 text-sm bg-raised text-fg1
          focus:outline-none focus:ring-2 focus:ring-acc focus:border-acc
          disabled:opacity-50
          ${error ? 'border-red-500' : 'border-line2'}
          ${className}`}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
