import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Shell from './components/Layout/Shell'
import Home from './pages/Home'
import InterviewBrowser from './pages/InterviewBrowser'
import InterviewTracker from './pages/InterviewTracker'
import PDFEditor from './pages/PDFEditor'
import PDFToWord from './pages/PDFToWord'
import MdEditor from './pages/MdEditor'
import JsonFormatter from './pages/JsonFormatter'
import DiffViewer from './pages/DiffViewer'
import Pomodoro from './pages/Pomodoro'
import Encoder from './pages/Encoder'
import RegexTester from './pages/RegexTester'
import Base64Image from './pages/Base64Image'
import QrGenerator from './pages/QrGenerator'
import ColorPalette from './pages/ColorPalette'
import ImageCompressor from './pages/ImageCompressor'
import CsvViewer from './pages/CsvViewer'
import Notes from './pages/Notes'
import TodoList from './pages/TodoList'
import ProjectMapper from './pages/ProjectMapper'
import DiagramEditor from './pages/DiagramEditor'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<Home />} />

          {/* Documents & PDF */}
          <Route path="browser"   element={<ErrorBoundary><InterviewBrowser /></ErrorBoundary>} />
          <Route path="tracker"   element={<ErrorBoundary><InterviewTracker /></ErrorBoundary>} />
          <Route path="pdf-editor" element={<ErrorBoundary><PDFEditor /></ErrorBoundary>} />
          <Route path="pdf-to-word" element={<ErrorBoundary><PDFToWord /></ErrorBoundary>} />

          {/* Text & Code */}
          <Route path="md-editor" element={<ErrorBoundary><MdEditor /></ErrorBoundary>} />
          <Route path="json"      element={<ErrorBoundary><JsonFormatter /></ErrorBoundary>} />
          <Route path="diff"      element={<ErrorBoundary><DiffViewer /></ErrorBoundary>} />
          <Route path="encoder"   element={<ErrorBoundary><Encoder /></ErrorBoundary>} />
          <Route path="regex"     element={<ErrorBoundary><RegexTester /></ErrorBoundary>} />

          {/* Productivity */}
          <Route path="pomodoro"  element={<ErrorBoundary><Pomodoro /></ErrorBoundary>} />
          <Route path="notes"     element={<ErrorBoundary><Notes /></ErrorBoundary>} />
          <Route path="todo"      element={<ErrorBoundary><TodoList /></ErrorBoundary>} />

          {/* Developer Tools */}
          <Route path="project-mapper" element={<ErrorBoundary><ProjectMapper /></ErrorBoundary>} />
          <Route path="diagram"        element={<ErrorBoundary><DiagramEditor /></ErrorBoundary>} />

          {/* Media & Visual */}
          <Route path="image-compressor" element={<ErrorBoundary><ImageCompressor /></ErrorBoundary>} />
          <Route path="csv"        element={<ErrorBoundary><CsvViewer /></ErrorBoundary>} />
          <Route path="qr"         element={<ErrorBoundary><QrGenerator /></ErrorBoundary>} />
          <Route path="colors"     element={<ErrorBoundary><ColorPalette /></ErrorBoundary>} />
          <Route path="base64-image" element={<ErrorBoundary><Base64Image /></ErrorBoundary>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
