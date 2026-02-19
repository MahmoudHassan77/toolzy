import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Shell from './components/Layout/Shell'
import Home from './pages/Home'
import InterviewBrowser from './pages/InterviewBrowser'
import InterviewTracker from './pages/InterviewTracker'
import PDFEditor from './pages/PDFEditor'
import PDFToWord from './pages/PDFToWord'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<Home />} />
          <Route
            path="browser"
            element={
              <ErrorBoundary>
                <InterviewBrowser />
              </ErrorBoundary>
            }
          />
          <Route
            path="tracker"
            element={
              <ErrorBoundary>
                <InterviewTracker />
              </ErrorBoundary>
            }
          />
          <Route
            path="pdf-editor"
            element={
              <ErrorBoundary>
                <PDFEditor />
              </ErrorBoundary>
            }
          />
          <Route
            path="pdf-to-word"
            element={
              <ErrorBoundary>
                <PDFToWord />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
