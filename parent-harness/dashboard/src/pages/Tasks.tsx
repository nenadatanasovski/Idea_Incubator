import { Layout } from '../components/Layout'
import { TaskCard, mockTasks } from '../components/TaskCard'

export function Tasks() {
  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Task Board</h1>
        <p className="text-gray-400">Manage and track all tasks</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {mockTasks.map((task) => (
            <TaskCard key={task.id} {...task} />
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default Tasks
