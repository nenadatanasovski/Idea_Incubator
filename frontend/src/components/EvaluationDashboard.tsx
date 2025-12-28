import { useCategoryScores, useEvaluations } from '../hooks/useEvaluations'
import { scoreInterpretation, categoryWeights } from '../types'
import type { EvaluationCategory } from '../types'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts'
import clsx from 'clsx'

interface EvaluationDashboardProps {
  slug: string
  runId?: string
}

const categoryLabels: Record<EvaluationCategory, string> = {
  problem: 'Problem',
  solution: 'Solution',
  feasibility: 'Feasibility',
  fit: 'Fit',
  market: 'Market',
  risk: 'Risk',
}

const categoryDescriptions: Record<EvaluationCategory, string> = {
  problem: 'Clarity, severity, target user, validation, uniqueness',
  solution: 'Clarity, feasibility, uniqueness, scalability, defensibility',
  feasibility: 'Technical, resources, skills, time to value, dependencies',
  fit: 'Personal, passion, skills, network, life stage',
  market: 'Size, growth, competition, entry barriers, timing',
  risk: 'Execution, market, technical, financial, regulatory',
}

function getBarColor(score: number): string {
  if (score >= 8.0) return '#22c55e'
  if (score >= 7.0) return '#84cc16'
  if (score >= 6.0) return '#eab308'
  if (score >= 5.0) return '#f97316'
  if (score >= 4.0) return '#ef4444'
  return '#991b1b'
}

export default function EvaluationDashboard({ slug, runId }: EvaluationDashboardProps) {
  const { scores, loading: scoresLoading } = useCategoryScores(slug, runId)
  const { evaluations, loading: evalsLoading } = useEvaluations(slug, runId)

  if (scoresLoading || evalsLoading) {
    return (
      <div className="card">
        <p className="text-gray-500">Loading evaluations...</p>
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No evaluations yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Run an evaluation: npm run evaluate {slug}
        </p>
      </div>
    )
  }

  // Calculate weighted average
  const weightedAvg = scores.reduce((acc, cat) => {
    const weight = categoryWeights[cat.category as EvaluationCategory] || 0
    return acc + cat.avg_score * weight
  }, 0)

  // Prepare radar chart data
  const radarData = scores.map((cat) => ({
    category: categoryLabels[cat.category as EvaluationCategory] || cat.category,
    score: cat.avg_score,
    fullMark: 10,
  }))

  // Prepare bar chart data for all criteria
  const barData = evaluations.map((eval_) => ({
    name: eval_.criterion.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    score: eval_.final_score,
    confidence: eval_.confidence,
    category: eval_.category,
  }))

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Overall Weighted Score
            </h3>
            <p className="text-sm text-gray-500">
              Based on {evaluations.length} criteria across 6 categories
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-4xl font-bold ${scoreInterpretation.getColor(weightedAvg)}`}
            >
              {weightedAvg.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">
              {scoreInterpretation.getLevel(weightedAvg)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Category Overview
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <PolarGrid />
                <PolarAngleAxis
                  dataKey="category"
                  tick={{ fill: '#374151', fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 10]}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#0ea5e9"
                  fill="#0ea5e9"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Cards */}
        <div className="space-y-3">
          {scores.map((cat) => (
            <div
              key={cat.category}
              className="card p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {categoryLabels[cat.category as EvaluationCategory]}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {categoryDescriptions[cat.category as EvaluationCategory]}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Weight: {(categoryWeights[cat.category as EvaluationCategory] * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className={`text-2xl font-bold ${scoreInterpretation.getColor(
                      cat.avg_score
                    )}`}
                  >
                    {cat.avg_score.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {Math.round(cat.avg_confidence * 100)}% conf
                  </div>
                </div>
              </div>
              {/* Score bar */}
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full', scoreInterpretation.getBgColor(cat.avg_score))}
                  style={{ width: `${(cat.avg_score / 10) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Criteria Bar Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          All Criteria Scores
        </h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <XAxis type="number" domain={[0, 10]} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#374151', fontSize: 11 }}
                width={110}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value.toFixed(1),
                  name === 'score' ? 'Score' : 'Confidence',
                ]}
                labelFormatter={(label) => `Criterion: ${label}`}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Criteria Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Detailed Reasoning
        </h3>
        <div className="space-y-4">
          {Object.entries(
            evaluations.reduce((acc, eval_) => {
              if (!acc[eval_.category]) acc[eval_.category] = []
              acc[eval_.category].push(eval_)
              return acc
            }, {} as Record<string, typeof evaluations>)
          ).map(([category, evals]) => (
            <div key={category}>
              <h4 className="font-medium text-gray-900 mb-2">
                {categoryLabels[category as EvaluationCategory]}
              </h4>
              <div className="space-y-2">
                {evals.map((eval_) => (
                  <div
                    key={eval_.criterion}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">
                        {eval_.criterion
                          .split('_')
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${scoreInterpretation.getColor(
                            eval_.final_score
                          )}`}
                        >
                          {eval_.final_score.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({Math.round(eval_.confidence * 100)}%)
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{eval_.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
