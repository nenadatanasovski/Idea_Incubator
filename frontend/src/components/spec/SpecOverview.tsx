/**
 * SpecOverview.tsx
 * Displays the specification overview section
 */

import { Users, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import type { Specification, Constraint } from '../../hooks/useSpecSession';

interface SpecOverviewProps {
  spec: Specification;
}

export function SpecOverview({ spec }: SpecOverviewProps) {
  const { overview, constraints, assumptions, confidence } = spec;

  return (
    <div className="space-y-6">
      {/* Confidence Score */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary-700">
            Specification Confidence
          </span>
          <span className="text-lg font-bold text-primary-800">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <div className="w-full bg-primary-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
        <p className="text-xs text-primary-600 mt-1">
          Based on ideation completeness and clarity
        </p>
      </div>

      {/* Name and Description */}
      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{overview.name}</h2>
        <p className="text-gray-600">{overview.description}</p>
      </div>

      {/* Problem Statement */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-primary-500" />
          <h3 className="font-medium text-gray-900">Problem Statement</h3>
        </div>
        <p className="text-gray-700 leading-relaxed">{overview.problemStatement}</p>
      </div>

      {/* Target Users */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="font-medium text-gray-900">Target Users</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview.targetUsers.map((user, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
            >
              {user}
            </span>
          ))}
        </div>
      </div>

      {/* Constraints */}
      {constraints.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-medium text-gray-900">Constraints</h3>
          </div>
          <div className="space-y-2">
            {constraints.map((constraint, index) => (
              <ConstraintItem key={index} constraint={constraint} />
            ))}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {assumptions.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h3 className="font-medium text-gray-900">Assumptions</h3>
          </div>
          <ul className="space-y-2">
            {assumptions.map((assumption, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="text-green-500 mt-0.5">•</span>
                <span>{assumption}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Version Info */}
      <div className="text-xs text-gray-400 text-right">
        Specification v{spec.version}
        {spec.generatedFrom && ` • Generated from handoff ${spec.generatedFrom}`}
      </div>
    </div>
  );
}

function ConstraintItem({ constraint }: { constraint: Constraint }) {
  const typeConfig = {
    technical: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Technical' },
    business: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Business' },
    legal: { bg: 'bg-red-50', text: 'text-red-700', label: 'Legal' },
  };

  const config = typeConfig[constraint.type] || typeConfig.technical;

  return (
    <div className="flex items-start gap-3 p-2 rounded-md bg-gray-50">
      <span
        className={clsx(
          'text-xs px-2 py-0.5 rounded font-medium shrink-0',
          config.bg,
          config.text
        )}
      >
        {config.label}
      </span>
      <p className="text-sm text-gray-700">{constraint.description}</p>
    </div>
  );
}

export default SpecOverview;
