import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import IdeaList from './pages/IdeaList'
import IdeaDetail from './pages/IdeaDetail'
import NewIdea from './pages/NewIdea'
import EditIdea from './pages/EditIdea'
import Comparison from './pages/Comparison'
import DebateList from './pages/DebateList'
import DebateSession from './pages/DebateSession'
import DebateViewer from './pages/DebateViewer'
import Profile from './pages/Profile'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ideas" element={<IdeaList />} />
        <Route path="/ideas/new" element={<NewIdea />} />
        <Route path="/ideas/:slug" element={<IdeaDetail />} />
        <Route path="/ideas/:slug/edit" element={<EditIdea />} />
        <Route path="/compare" element={<Comparison />} />
        <Route path="/debate" element={<DebateList />} />
        <Route path="/debate/live" element={<DebateViewer />} />
        <Route path="/debate/live/:slug" element={<DebateViewer />} />
        <Route path="/debate/session/:runId" element={<DebateSession />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Layout>
  )
}

export default App
