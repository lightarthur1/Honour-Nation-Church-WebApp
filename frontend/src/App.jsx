import { Route, Routes } from 'react-router-dom'
import Footer from './components/layout/Footer'
import Navbar from './components/layout/Navbar'
import AdminPanel from './pages/AdminPanel'
import EditorWorkspace from './pages/EditorWorkspace'
import EventGallery from './pages/EventGallery'
import FeedPage from './pages/FeedPage'
import HomePage from './pages/HomePage'
import Login from './pages/Login'
import NoticeBoardPage from './pages/NoticeBoardPage'
import DocumentsPage from './pages/DocumentsPage'
import PlanYourVisit from './pages/PlanYourVisit'
import ContactPage from './pages/ContactPage'
import ProgramEventDetail from './pages/ProgramEventDetail'
import PublicEventsPage from './pages/PublicEventsPage'
import PublicGallery from './pages/PublicGallery'
import WatchPage from './pages/WatchPage'
import ProtectedRoute from './routes/ProtectedRoute'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/watch" element={<WatchPage />} />
        <Route path="/notices" element={<NoticeBoardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/visit" element={<PlanYourVisit />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/events" element={<PublicEventsPage />} />
        <Route path="/events/programs/:id" element={<ProgramEventDetail />} />
        <Route path="/gallery" element={<PublicGallery />} />
        <Route path="/events/:id" element={<EventGallery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>} />
        <Route path="/editor" element={<ProtectedRoute roles={['editor', 'admin']}><EditorWorkspace /></ProtectedRoute>} />
        <Route path="*" element={<main className="p-10 text-center opacity-70">Page not found.</main>} />
      </Routes>
      <Footer />
    </>
  )
}
