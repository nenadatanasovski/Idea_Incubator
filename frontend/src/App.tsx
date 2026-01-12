import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import IdeaList from './pages/IdeaList'
import IdeaDetail from './pages/IdeaDetail'
import IdeaDetailPhased from './pages/IdeaDetailPhased'
import NewIdea from './pages/NewIdea'
import EditIdea from './pages/EditIdea'
import Comparison from './pages/Comparison'
import DebateList from './pages/DebateList'
import DebateSession from './pages/DebateSession'
import DebateViewer from './pages/DebateViewer'
import EventLog from './pages/EventLog'
import Profile from './pages/Profile'
import AgentDashboard from './pages/AgentDashboard'
import AgentDetailPage from './pages/AgentDetailPage'
import KanbanBoard from './pages/KanbanBoard'
import TaskListBrowser from './pages/TaskListBrowser'
import IdeationPageWrapper from './pages/IdeationPageWrapper'
import NotificationPreferences from './pages/NotificationPreferences'
import NotFound from './pages/NotFound'

// Feature flag: Set to true to use the new phase-based UI
const USE_PHASED_UI = true

function App() {
  // Use the appropriate IdeaDetail component based on feature flag
  const IdeaDetailComponent = USE_PHASED_UI ? IdeaDetailPhased : IdeaDetail

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ideas" element={<IdeaList />} />
        <Route path="/ideas/new" element={<NewIdea />} />
        <Route path="/ideas/:slug" element={<IdeaDetailComponent />} />
        <Route path="/ideas/:slug/edit" element={<EditIdea />} />
        <Route path="/compare" element={<Comparison />} />
        <Route path="/debate" element={<DebateList />} />
        <Route path="/debate/live" element={<DebateViewer />} />
        <Route path="/debate/live/:slug" element={<DebateViewer />} />
        <Route path="/debate/session/:runId" element={<DebateSession />} />
        <Route path="/events" element={<EventLog />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings/notifications" element={<NotificationPreferences />} />
        <Route path="/agents" element={<AgentDashboard />} />
        <Route path="/agents/:agentId" element={<AgentDetailPage />} />
        <Route path="/tasks" element={<TaskListBrowser />} />
        <Route path="/tasks/kanban" element={<KanbanBoard />} />
        <Route path="/ideate" element={<IdeationPageWrapper />} />
        <Route path="/ideate/:sessionId" element={<IdeationPageWrapper />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

export default App
