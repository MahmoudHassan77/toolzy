# Toolzy

A local-first productivity dashboard with four tools, built with Vite + React + TypeScript.

## Tools

### Interview Questions Browser
Browse a local folder of Markdown files in a split-pane view with a collapsible file tree, search filter, and rendered Markdown preview.
> Requires Chrome or Edge 86+ (File System Access API).

### Interview Tracker
Track job applications with full CRUD, status badges, round-by-round interview notes, salary ranges, and filters. Data persists in `localStorage`. Export and import via Excel (`.xlsx`).

### PDF Editor
Annotate PDFs with highlights, whiteout, freehand drawing, shapes (rectangle, ellipse, line, arrow), text boxes, stamps, and signatures. Undo/redo support. Downloads an annotated PDF with embedded annotations via `pdf-lib`.

### PDF to Word
Extracts text from a PDF — preserving bold, italic, font sizes, heading levels, paragraph spacing, and reading order — and downloads a `.docx` file. Works with text-based PDFs only.

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 18, TypeScript, Tailwind CSS |
| Routing | React Router v6 |
| PDF render | pdfjs-dist |
| PDF write | pdf-lib |
| Word export | docx, file-saver |
| Excel | xlsx |
| Markdown | react-markdown, remark-gfm |
| Signatures | react-signature-canvas |
| File drop | react-dropzone |
| Build | Vite |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Notes

- All data stays local — no backend, no network requests.
- The Interview Questions Browser requires the File System Access API (Chrome / Edge 86+).
- The PDF Editor's signature and text annotations are embedded into the downloaded PDF.
- Scanned PDFs (image-only) are not supported by the PDF to Word converter.
