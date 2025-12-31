import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lightbulb, TrendingUp, DollarSign, BarChart3, Download, Upload, Play, Loader2, Plus } from 'lucide-react'
import { getStats, getExportAllIdeasUrl, getExportCsvUrl, downloadExport, importIdeas, triggerEvaluation } from '../api/client'
import { useIdeas } from '../hooks/useIdeas'
import { lifecycleStages, scoreInterpretation } from '../types'
import type { LifecycleStage, IdeaType } from '../types'

interface Stats {
  totalIdeas: number
  byType: Record<string, number>
  byStage: Record<string, number>
  avgScore: number
  totalCost: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const { ideas, loading: ideasLoading } = useIdeas({ sortBy: 'updated_at', sortOrder: 'desc' })
  const [evaluatingSlug, setEvaluatingSlug] = useState<string | null>(null)

  useEffect(() => {
    getStats().then(setStats).catch(console.error)
  }, [])

  const handleQuickEvaluate = async (slug: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEvaluatingSlug(slug)
    try {
      await triggerEvaluation(slug)
      navigate(`/debate/live/${slug}`)
    } catch (error) {
      console.error('Failed to start evaluation:', error)
      setEvaluatingSlug(null)
    }
  }

  const recentIdeas = ideas.slice(0, 5)

  const ideaTypeLabels: Record<IdeaType, string> = {
    business: 'Business',
    creative: 'Creative',
    technical: 'Technical',
    personal: 'Personal',
    research: 'Research',
  }

  const ideaTypeColors: Record<IdeaType, string> = {
    business: 'bg-blue-100 text-blue-800',
    creative: 'bg-purple-100 text-purple-800',
    technical: 'bg-green-100 text-green-800',
    personal: 'bg-orange-100 text-orange-800',
    research: 'bg-cyan-100 text-cyan-800',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your idea incubator
        </p>
      </div>

      {/* Stats Row - Compact inline stats */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-xs text-gray-500">Ideas</p>
              <p className="text-xl font-bold text-gray-900">{stats?.totalIdeas ?? '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-gray-500">Avg Score</p>
              <p className="text-xl font-bold text-gray-900">{stats?.avgScore ? stats.avgScore.toFixed(1) : '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-xs text-gray-500">Total Cost</p>
              <p className="text-xl font-bold text-gray-900">${stats?.totalCost?.toFixed(2) ?? '0.00'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-500">Evaluated</p>
              <p className="text-xl font-bold text-gray-900">{ideas.filter(i => i.avg_final_score !== null).length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Ideas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Ideas</h2>
            <Link
              to="/ideas"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View all
            </Link>
          </div>
          {ideasLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : recentIdeas.length === 0 ? (
            <div className="text-center py-6">
              <Lightbulb className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-3">No ideas yet. Start capturing your ideas!</p>
              <Link
                to="/ideas/new"
                className="btn btn-primary inline-flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Idea
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentIdeas.map((idea) => (
                <li key={idea.id} className="py-3">
                  <Link
                    to={`/ideas/${idea.slug}`}
                    className="flex items-center justify-between hover:bg-gray-50 -mx-3 px-3 py-2 rounded-md group"
                  >
                    <div className="flex items-center min-w-0">
                      <span
                        className={`badge ${ideaTypeColors[idea.idea_type]}`}
                      >
                        {ideaTypeLabels[idea.idea_type]}
                      </span>
                      <span className="ml-3 text-sm font-medium text-gray-900 truncate">
                        {idea.title}
                      </span>
                    </div>
                    <div className="flex items-center ml-4 gap-2">
                      {idea.avg_final_score === null && (
                        <button
                          onClick={(e) => handleQuickEvaluate(idea.slug, e)}
                          disabled={evaluatingSlug === idea.slug}
                          className="opacity-0 group-hover:opacity-100 transition-opacity btn btn-sm btn-primary inline-flex items-center"
                          title="Run Evaluation"
                        >
                          {evaluatingSlug === idea.slug ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </button>
                      )}
                      {idea.avg_final_score !== null && (
                        <span
                          className={`text-sm font-medium ${scoreInterpretation.getColor(idea.avg_final_score)}`}
                        >
                          {idea.avg_final_score.toFixed(2)}
                        </span>
                      )}
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          lifecycleStages[idea.lifecycle_stage as LifecycleStage]?.color || 'bg-gray-400'
                        }`}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ideas by Type */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ideas by Type
          </h2>
          {stats?.byType ? (
            <div className="space-y-3">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center">
                  <span className={`badge ${ideaTypeColors[type as IdeaType]}`}>
                    {ideaTypeLabels[type as IdeaType]}
                  </span>
                  <div className="flex-1 mx-3">
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-primary-500 rounded-full"
                        style={{
                          width: `${(count / stats.totalIdeas) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No data</p>
          )}
        </div>

        {/* Ideas by Stage */}
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Lifecycle Distribution
          </h2>
          {stats?.byStage ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(lifecycleStages)
                .sort((a, b) => a[1].order - b[1].order)
                .map(([stage, meta]) => {
                  const count = stats.byStage[stage] || 0
                  if (count === 0) return null
                  return (
                    <div
                      key={stage}
                      className={`${meta.color} text-white px-3 py-1.5 rounded-full text-sm font-medium`}
                    >
                      {meta.label}: {count}
                    </div>
                  )
                })}
            </div>
          ) : (
            <p className="text-gray-500">No data</p>
          )}
        </div>

        {/* Export/Import - Compact toolbar */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Data Management</h2>
            <div className="flex gap-2">
              <button
                onClick={() => downloadExport(getExportAllIdeasUrl())}
                className="btn btn-secondary btn-sm inline-flex items-center"
              >
                <Download className="h-3 w-3 mr-1" />
                JSON
              </button>
              <button
                onClick={() => downloadExport(getExportCsvUrl())}
                className="btn btn-secondary btn-sm inline-flex items-center"
              >
                <Download className="h-3 w-3 mr-1" />
                CSV
              </button>
              <label className="btn btn-secondary btn-sm inline-flex items-center cursor-pointer">
                <Upload className="h-3 w-3 mr-1" />
                Import
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const text = await file.text()
                      const data = JSON.parse(text)
                      const result = await importIdeas(data)
                      alert(`Import complete: ${result.imported} imported, ${result.skipped} skipped${result.errors.length ? '\nErrors: ' + result.errors.join(', ') : ''}`)
                      window.location.reload()
                    } catch (error) {
                      alert('Import failed: ' + (error as Error).message)
                    }
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
