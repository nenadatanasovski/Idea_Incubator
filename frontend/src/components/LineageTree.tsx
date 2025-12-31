import { GitBranch, GitMerge, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import type { IdeaLineage, IdeaSummary } from '../api/client'

interface LineageTreeProps {
  lineage: IdeaLineage
  currentSlug: string
}

interface IdeaNodeProps {
  idea: IdeaSummary
  isCurrent: boolean
  isParent?: boolean
  isChild?: boolean
}

function IdeaNode({ idea, isCurrent, isParent, isChild }: IdeaNodeProps) {
  return (
    <div
      className={`p-3 rounded-lg border-2 transition-all ${
        isCurrent
          ? 'border-blue-500 bg-blue-50'
          : isParent
          ? 'border-purple-300 bg-purple-50'
          : isChild
          ? 'border-green-300 bg-green-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link
            to={`/ideas/${idea.slug}`}
            className={`font-medium hover:underline truncate block ${
              isCurrent ? 'text-blue-700' : 'text-gray-900'
            }`}
          >
            {idea.title}
          </Link>
          <div className="text-xs text-gray-500 mt-0.5">{idea.slug}</div>
        </div>
        <StatusBadge status={idea.status} size="sm" showLabel={false} />
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span>v{idea.currentVersion}</span>
        {idea.latestScore !== undefined && (
          <span className="font-medium">
            Score: {idea.latestScore.toFixed(1)}/10
          </span>
        )}
      </div>

      {idea.branchReason && (
        <div className="mt-2 text-xs text-gray-600 bg-gray-100 rounded p-1.5">
          {idea.branchReason}
        </div>
      )}

      {isCurrent && (
        <div className="mt-2 text-xs text-blue-600 font-medium">Current Idea</div>
      )}
    </div>
  )
}

export default function LineageTree({ lineage, currentSlug }: LineageTreeProps) {
  const hasAncestors = lineage.ancestors.length > 0
  const hasParent = !!lineage.parent
  const hasChildren = lineage.children.length > 0

  if (!hasAncestors && !hasParent && !hasChildren) {
    return (
      <div className="card text-center py-8 text-gray-500">
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>This idea has no branches or parent ideas</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <GitMerge className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Idea Family Tree</h3>
      </div>

      <div className="space-y-4">
        {/* Ancestors (oldest first) */}
        {hasAncestors && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Ancestors
            </div>
            {[...lineage.ancestors].reverse().map((ancestor, index) => (
              <div key={ancestor.id} style={{ marginLeft: `${index * 16}px` }}>
                <IdeaNode idea={ancestor} isCurrent={false} />
                <div className="flex items-center justify-center py-1">
                  <ArrowRight className="h-4 w-4 text-gray-400 rotate-90" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parent */}
        {hasParent && lineage.parent && (
          <div style={{ marginLeft: `${lineage.ancestors.length * 16}px` }}>
            <IdeaNode idea={lineage.parent} isCurrent={false} isParent />
            <div className="flex items-center justify-center py-1">
              <ArrowRight className="h-4 w-4 text-gray-400 rotate-90" />
            </div>
          </div>
        )}

        {/* Current */}
        <div
          style={{
            marginLeft: `${(lineage.ancestors.length + (hasParent ? 1 : 0)) * 16}px`
          }}
        >
          <IdeaNode
            idea={lineage.current}
            isCurrent={lineage.current.slug === currentSlug}
          />
        </div>

        {/* Children */}
        {hasChildren && (
          <div
            className="space-y-2"
            style={{
              marginLeft: `${(lineage.ancestors.length + (hasParent ? 1 : 0) + 1) * 16}px`
            }}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <GitBranch className="h-3 w-3" />
              Branches ({lineage.children.length})
            </div>
            {lineage.children.map(child => (
              <div key={child.id}>
                <div className="flex items-center py-1">
                  <ArrowRight className="h-4 w-4 text-gray-400 rotate-90" />
                </div>
                <IdeaNode idea={child} isCurrent={child.slug === currentSlug} isChild />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
