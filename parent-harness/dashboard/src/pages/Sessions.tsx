import { Layout } from '../components/Layout'

export function Sessions() {
  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Agent Sessions</h1>
        <p className="text-gray-400">View agent session history and iterations</p>
        
        <div className="bg-gray-700 rounded-lg p-6 mt-6">
          <p className="text-gray-400 text-center">
            Session data will be displayed here once connected to the API.
          </p>
        </div>
      </div>
    </Layout>
  )
}

export default Sessions
