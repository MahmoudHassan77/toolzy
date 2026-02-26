import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Shell from './components/Layout/Shell'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import OAuthCallback from './pages/OAuthCallback'
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
import StoryBoard from './pages/StoryBoard'
import Calendar from './pages/Calendar'
import LinkVault from './pages/LinkVault'
import ErrorBoundary from './components/ErrorBoundary'

function Premium({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><ErrorBoundary>{children}</ErrorBoundary></ProtectedRoute>
}

function Free({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no Shell */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        {/* Dashboard routes — inside Shell */}
        <Route path="/dashboard" element={<Shell />}>
          <Route index element={<Home />} />

          {/* Free tools — no auth guard */}
          <Route path="encoder" element={<Free><Encoder /></Free>} />
          <Route path="regex" element={<Free><RegexTester /></Free>} />
          <Route path="json" element={<Free><JsonFormatter /></Free>} />
          <Route path="qr" element={<Free><QrGenerator /></Free>} />
          <Route path="colors" element={<Free><ColorPalette /></Free>} />
          <Route path="base64-image" element={<Free><Base64Image /></Free>} />
          <Route path="csv" element={<Free><CsvViewer /></Free>} />
          <Route path="diff" element={<Free><DiffViewer /></Free>} />
          <Route path="pomodoro" element={<Free><Pomodoro /></Free>} />
          <Route path="notes" element={<Free><Notes /></Free>} />
          <Route path="todo" element={<Free><TodoList /></Free>} />
          <Route path="image-compressor" element={<Free><ImageCompressor /></Free>} />
          <Route path="md-editor" element={<Free><MdEditor /></Free>} />
          <Route path="links" element={<Free><LinkVault /></Free>} />

          {/* Premium tools — require auth */}
          <Route path="pdf-editor" element={<Premium><PDFEditor /></Premium>} />
          <Route path="pdf-to-word" element={<Premium><PDFToWord /></Premium>} />
          <Route path="diagram" element={<Premium><DiagramEditor /></Premium>} />
          <Route path="storyboard" element={<Premium><StoryBoard /></Premium>} />
          <Route path="calendar" element={<Premium><Calendar /></Premium>} />
          <Route path="project-mapper" element={<Premium><ProjectMapper /></Premium>} />
          <Route path="browser" element={<Premium><InterviewBrowser /></Premium>} />
          <Route path="tracker" element={<Premium><InterviewTracker /></Premium>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
