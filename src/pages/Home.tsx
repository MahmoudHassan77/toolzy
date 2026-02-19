import { useNavigate } from 'react-router-dom'

const services = [
  {
    to: '/browser',
    title: 'Interview Questions Browser',
    description: 'Browse local markdown files with a folder tree. Pick any directory and navigate your interview prep notes.',
    color: 'from-amber-500 to-yellow-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    to: '/tracker',
    title: 'Interview Tracker',
    description: 'Track job applications, interview rounds, and outcomes. Export to Excel and import back seamlessly.',
    color: 'from-emerald-500 to-teal-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    to: '/pdf-editor',
    title: 'PDF Editor',
    description: 'Annotate PDFs with highlights, text overlays, and signatures. Embed annotations and download.',
    color: 'from-orange-500 to-red-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    to: '/pdf-to-word',
    title: 'PDF to Word',
    description: 'Extract text from PDFs and convert to a downloadable .docx file with heading detection.',
    color: 'from-sky-500 to-blue-600',
    icon: (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    ),
  },
]

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-fg1">Welcome to Toolzy</h2>
        <p className="mt-1 text-fg2 text-sm">Your all-in-one productivity dashboard. Pick a service to get started.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {services.map((s) => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="group text-left rounded-2xl border border-line bg-surface p-6 shadow-sm hover:shadow-md hover:border-acc/50 transition-all"
          >
            <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${s.color} mb-4`}>
              {s.icon}
            </div>
            <h3 className="font-semibold text-fg1 group-hover:text-acc transition-colors">
              {s.title}
            </h3>
            <p className="mt-1 text-sm text-fg2 leading-relaxed">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
