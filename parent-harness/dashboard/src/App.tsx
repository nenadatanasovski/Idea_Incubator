import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Sessions } from './pages/Sessions'
import { Config } from './pages/Config'
import { Agents } from './pages/Agents'
import { AgentRegistry } from './pages/AgentRegistry'
import { Telegram } from './pages/Telegram'
import { Cron } from './pages/Cron'
import { EventBus } from './pages/EventBus'
import { EventSystem } from './pages/EventSystem'
import { AgentActivity } from './pages/AgentActivity'
import { Waves } from './pages/Waves'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/activity" element={<AgentActivity />} />
        <Route path="/waves" element={<Waves />} />
        <Route path="/registry" element={<AgentRegistry />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/telegram" element={<Telegram />} />
        <Route path="/cron" element={<Cron />} />
        <Route path="/events" element={<EventBus />} />
        <Route path="/system" element={<EventSystem />} />
        <Route path="/config" element={<Config />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
