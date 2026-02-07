import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Sessions } from './pages/Sessions'
import { Config } from './pages/Config'
import { Agents } from './pages/Agents'
import { Telegram } from './pages/Telegram'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/telegram" element={<Telegram />} />
        <Route path="/config" element={<Config />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
