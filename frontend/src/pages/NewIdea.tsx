import { Link } from 'react-router-dom'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import IdeaForm from '../components/IdeaForm'

export default function NewIdea() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/ideas"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to ideas
      </Link>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
            <Lightbulb className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Capture a New Idea</h1>
            <p className="text-sm text-gray-500">
              Describe your idea and we'll help you evaluate it
            </p>
          </div>
        </div>

        <IdeaForm mode="create" />
      </div>
    </div>
  )
}
