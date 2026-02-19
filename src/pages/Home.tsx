import { useNavigate } from 'react-router-dom'

interface Tool {
  to: string
  title: string
  description: string
  color: string
  icon: React.ReactNode
}

interface Section {
  heading: string
  tools: Tool[]
}

const sections: Section[] = [
  {
    heading: 'Documents & PDF',
    tools: [
      {
        to: '/browser',
        title: 'Interview Browser',
        description: 'Browse local markdown files with a folder tree. Navigate your interview prep notes.',
        color: 'from-amber-500 to-yellow-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
      },
      {
        to: '/tracker',
        title: 'Interview Tracker',
        description: 'Track job applications and interview rounds. Export to Excel and import back.',
        color: 'from-emerald-500 to-teal-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        to: '/pdf-editor',
        title: 'PDF Editor',
        description: 'Annotate PDFs with highlights, text overlays, and signatures. Embed and download.',
        color: 'from-orange-500 to-red-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
      },
      {
        to: '/pdf-to-word',
        title: 'PDF to Word',
        description: 'Extract text from PDFs and convert to a downloadable .docx with heading detection.',
        color: 'from-sky-500 to-blue-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: 'Text & Code',
    tools: [
      {
        to: '/md-editor',
        title: 'Markdown Editor',
        description: 'Side-by-side Markdown editor with live preview and HTML export.',
        color: 'from-violet-500 to-purple-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h10m-10 6h16" />
          </svg>
        ),
      },
      {
        to: '/json',
        title: 'JSON Formatter',
        description: 'Format or minify JSON with syntax validation and one-click copy.',
        color: 'from-lime-500 to-green-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        ),
      },
      {
        to: '/diff',
        title: 'Diff Viewer',
        description: 'Compare two text blocks and see color-coded added/removed lines.',
        color: 'from-rose-500 to-pink-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        ),
      },
      {
        to: '/encoder',
        title: 'Base64 / URL Encoder',
        description: 'Encode and decode Base64 strings and URL components instantly.',
        color: 'from-cyan-500 to-sky-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        ),
      },
      {
        to: '/regex',
        title: 'Regex Tester',
        description: 'Test regular expressions with live match highlighting and match list.',
        color: 'from-fuchsia-500 to-violet-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: 'Productivity',
    tools: [
      {
        to: '/pomodoro',
        title: 'Pomodoro Timer',
        description: '25/5 minute focus timer with session log and browser tab countdown.',
        color: 'from-red-500 to-rose-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        to: '/notes',
        title: 'Notes',
        description: 'Multi-tab notepad with inline title editing and word count. Persists locally.',
        color: 'from-yellow-500 to-amber-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16 3l5 5-9 9H7v-5L16 3z" />
          </svg>
        ),
      },
      {
        to: '/todo',
        title: 'Todo List',
        description: 'Task manager with priorities, due dates, and All/Active/Done filters.',
        color: 'from-teal-500 to-emerald-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h3m-3 4h3m2-4h.01M16 16h.01" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: 'Media & Visual',
    tools: [
      {
        to: '/image-compressor',
        title: 'Image Compressor',
        description: 'Drop an image, adjust quality, and download a compressed JPEG with size savings.',
        color: 'from-indigo-500 to-blue-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        to: '/csv',
        title: 'CSV Viewer',
        description: 'Open CSV, TSV, or Excel files as a sortable, filterable table.',
        color: 'from-green-500 to-lime-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
          </svg>
        ),
      },
      {
        to: '/qr',
        title: 'QR Code',
        description: 'Generate QR codes from any text or URL and download as PNG.',
        color: 'from-slate-500 to-gray-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4h.01M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm8 4h.01M16 16h4v4h-4v-4zM8 8h.01M16 8h.01M8 16h.01" />
          </svg>
        ),
      },
      {
        to: '/colors',
        title: 'Color Palette',
        description: 'Pick colors and get HEX, RGB, HSL values. Save a reusable palette locally.',
        color: 'from-pink-500 to-fuchsia-600',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        ),
      },
      {
        to: '/base64-image',
        title: 'Base64 to Image',
        description: 'Paste a base64 string to preview and download the decoded image.',
        color: 'from-orange-400 to-amber-500',
        icon: (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        ),
      },
    ],
  },
]

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="p-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fg1">Welcome to Toolzy</h2>
        <p className="mt-1 text-fg2 text-sm">Your all-in-one productivity dashboard — 17 tools, all client-side.</p>
      </div>

      <div className="flex flex-col gap-8">
        {sections.map(section => (
          <div key={section.heading}>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-fg3 mb-3">
              {section.heading}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.tools.map(tool => (
                <button
                  key={tool.to}
                  onClick={() => navigate(tool.to)}
                  className="group text-left rounded-xl border border-line bg-surface p-5 shadow-sm hover:shadow-md hover:border-acc/50 transition-all"
                >
                  <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${tool.color} mb-3`}>
                    {tool.icon}
                  </div>
                  <h4 className="font-semibold text-sm text-fg1 group-hover:text-acc transition-colors">
                    {tool.title}
                  </h4>
                  <p className="mt-1 text-xs text-fg2 leading-relaxed">{tool.description}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
