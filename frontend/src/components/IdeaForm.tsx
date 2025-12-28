import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X, Loader2, AlertCircle } from 'lucide-react'
import { createIdea, updateIdea, type CreateIdeaInput } from '../api/client'
import { lifecycleStages, type LifecycleStage, type IdeaType } from '../types'

interface IdeaFormProps {
  mode: 'create' | 'edit'
  initialData?: {
    title: string
    summary: string | null
    idea_type: IdeaType
    lifecycle_stage: LifecycleStage
    content: string | null
    tags: string[]
  }
  slug?: string
  onSuccess?: () => void
  onCancel?: () => void
}

const ideaTypes: { value: IdeaType; label: string }[] = [
  { value: 'business', label: 'Business' },
  { value: 'creative', label: 'Creative' },
  { value: 'technical', label: 'Technical' },
  { value: 'personal', label: 'Personal' },
  { value: 'research', label: 'Research' },
]

export default function IdeaForm({
  mode,
  initialData,
  slug,
  onSuccess,
  onCancel,
}: IdeaFormProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(initialData?.title || '')
  const [summary, setSummary] = useState(initialData?.summary || '')
  const [ideaType, setIdeaType] = useState<IdeaType>(initialData?.idea_type || 'business')
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage>(
    initialData?.lifecycle_stage || 'SPARK'
  )
  const [content, setContent] = useState(initialData?.content || '')
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(', ') || '')

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title)
      setSummary(initialData.summary || '')
      setIdeaType(initialData.idea_type)
      setLifecycleStage(initialData.lifecycle_stage)
      setContent(initialData.content || '')
      setTagsInput(initialData.tags?.join(', ') || '')
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const data: CreateIdeaInput = {
      title,
      summary: summary || undefined,
      idea_type: ideaType,
      lifecycle_stage: lifecycleStage,
      content: content || undefined,
      tags: tags.length > 0 ? tags : undefined,
    }

    try {
      if (mode === 'create') {
        const result = await createIdea(data)
        if (onSuccess) {
          onSuccess()
        } else {
          navigate(`/ideas/${result.slug}`)
        }
      } else if (slug) {
        await updateIdea(slug, data)
        if (onSuccess) {
          onSuccess()
        } else {
          navigate(`/ideas/${slug}`)
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="What's your idea?"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
        />
      </div>

      {/* Summary */}
      <div>
        <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
          Summary
        </label>
        <textarea
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="A brief one-liner describing your idea"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
        />
      </div>

      {/* Type and Stage */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ideaType" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="ideaType"
            value={ideaType}
            onChange={(e) => setIdeaType(e.target.value as IdeaType)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            {ideaTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="lifecycleStage" className="block text-sm font-medium text-gray-700 mb-1">
            Lifecycle Stage
          </label>
          <select
            id="lifecycleStage"
            value={lifecycleStage}
            onChange={(e) => setLifecycleStage(e.target.value as LifecycleStage)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            {Object.entries(lifecycleStages)
              .sort((a, b) => a[1].order - b[1].order)
              .map(([stage, meta]) => (
                <option key={stage} value={stage}>
                  {meta.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
          Tags
        </label>
        <input
          type="text"
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="ai, saas, productivity (comma-separated)"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
        />
        <p className="mt-1 text-xs text-gray-500">Separate tags with commas</p>
      </div>

      {/* Content */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Full Description
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Describe your idea in detail. What problem does it solve? Who is it for? How would it work?"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">Markdown is supported</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel || (() => navigate(-1))}
          disabled={loading}
          className="btn btn-secondary inline-flex items-center"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="btn btn-primary inline-flex items-center"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {mode === 'create' ? 'Create Idea' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
