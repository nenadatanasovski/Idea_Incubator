import { Layout } from '../components/Layout'
import { AgentStatusCard, mockAgents } from '../components/AgentStatusCard'
import { EventStream, mockEvents } from '../components/EventStream'
import { TaskCard, mockTasks } from '../components/TaskCard'

export function Dashboard() {
  return (
    <Layout
      leftPanel={
        <div className="space-y-2">
          {mockAgents.map((agent) => (
            <AgentStatusCard key={agent.id} {...agent} />
          ))}
        </div>
      }
      rightPanel={
        <div className="space-y-2">
          {mockTasks.map((task) => (
            <TaskCard key={task.id} {...task} />
          ))}
        </div>
      }
    >
      <EventStream events={mockEvents} />
    </Layout>
  )
}

export default Dashboard
