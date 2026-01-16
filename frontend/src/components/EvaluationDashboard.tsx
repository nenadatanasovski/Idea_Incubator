import {
  useCategoryScores,
  useEvaluations,
  useDebateRounds,
  usePreviousRunScores,
} from "../hooks/useEvaluations";
import { scoreInterpretation, categoryWeights } from "../types";
import type { EvaluationCategory } from "../types";
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
} from "recharts";
import clsx from "clsx";

interface EvaluationDashboardProps {
  slug: string;
  runId?: string;
}

const categoryLabels: Record<EvaluationCategory, string> = {
  problem: "Problem",
  solution: "Solution",
  feasibility: "Feasibility",
  fit: "Fit",
  market: "Market",
  risk: "Risk",
};

const categoryDescriptions: Record<EvaluationCategory, string> = {
  problem: "Clarity, severity, target user, validation, uniqueness",
  solution: "Clarity, feasibility, uniqueness, scalability, defensibility",
  feasibility: "Technical, resources, skills, time to value, dependencies",
  fit: "Personal, passion, skills, network, life stage",
  market: "Size, growth, competition, entry barriers, timing",
  risk: "Execution, market, technical, financial, regulatory",
};

function getBarColor(score: number): string {
  if (score >= 8.0) return "#22c55e";
  if (score >= 7.0) return "#84cc16";
  if (score >= 6.0) return "#eab308";
  if (score >= 5.0) return "#f97316";
  if (score >= 4.0) return "#ef4444";
  return "#991b1b";
}

export default function EvaluationDashboard({
  slug,
  runId,
}: EvaluationDashboardProps) {
  const { scores, loading: scoresLoading } = useCategoryScores(slug, runId);
  const { evaluations, loading: evalsLoading } = useEvaluations(slug, runId);
  const { rounds } = useDebateRounds(slug, runId);
  const { previousScores } = usePreviousRunScores(slug, runId);

  // Build lookup map for previous scores by criterion (from previous evaluation run)
  const previousScoresByCriterion = new Map<string, number>();
  if (previousScores) {
    for (const cat of previousScores) {
      for (const criterion of cat.criteria) {
        previousScoresByCriterion.set(
          criterion.criterion,
          criterion.final_score,
        );
      }
    }
  }

  if (scoresLoading || evalsLoading) {
    return (
      <div className="card">
        <p className="text-gray-500">Loading evaluations...</p>
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">No evaluations yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Run an evaluation: npm run evaluate {slug}
        </p>
      </div>
    );
  }

  // Calculate weighted average
  const weightedAvg = scores.reduce((acc, cat) => {
    const weight = categoryWeights[cat.category as EvaluationCategory] || 0;
    return acc + cat.avg_score * weight;
  }, 0);

  // Prepare radar chart data
  const radarData = scores.map((cat) => ({
    category:
      categoryLabels[cat.category as EvaluationCategory] || cat.category,
    score: cat.avg_score,
    fullMark: 10,
  }));

  // Prepare bar chart data for all criteria
  const barData = evaluations.map((eval_) => ({
    name: eval_.criterion
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    score: eval_.final_score,
    confidence: eval_.confidence,
    category: eval_.category,
  }));

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
              {weightedAvg.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
              {scoreInterpretation.getLevel(weightedAvg)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="card flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Category Overview
          </h3>
          <div className="flex-1 min-h-0" style={{ minHeight: "350px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={radarData}
                margin={{ top: 10, right: 40, bottom: 10, left: 40 }}
              >
                <PolarGrid gridType="polygon" />
                <PolarAngleAxis
                  dataKey="category"
                  tick={{ fill: "#374151", fontSize: 12 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 10]}
                  tickCount={11}
                  tick={{ fill: "#9ca3af", fontSize: 9 }}
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
        <div className="space-y-2">
          {scores.map((cat) => (
            <button
              key={cat.category}
              className="card p-3 w-full text-left hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => {
                document
                  .getElementById(`category-${cat.category}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {categoryLabels[cat.category as EvaluationCategory]}
                    </h4>
                    <span className="text-xs text-gray-400">
                      {(
                        categoryWeights[cat.category as EvaluationCategory] *
                        100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {categoryDescriptions[cat.category as EvaluationCategory]}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span
                    className={`text-2xl font-bold ${scoreInterpretation.getColor(
                      cat.avg_score,
                    )}`}
                  >
                    {cat.avg_score.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {Math.round(cat.avg_confidence * 100)}%
                  </span>
                </div>
              </div>
              {/* Score bar */}
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full",
                    scoreInterpretation.getBgColor(cat.avg_score),
                  )}
                  style={{ width: `${(cat.avg_score / 10) * 100}%` }}
                />
              </div>
            </button>
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
                tick={{ fill: "#374151", fontSize: 11 }}
                width={110}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value.toFixed(1),
                  name === "score" ? "Score" : "Confidence",
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
            evaluations.reduce(
              (acc, eval_) => {
                if (!acc[eval_.category]) acc[eval_.category] = [];
                acc[eval_.category].push(eval_);
                return acc;
              },
              {} as Record<string, typeof evaluations>,
            ),
          ).map(([category, evals]) => (
            <div
              key={category}
              id={`category-${category}`}
              className="scroll-mt-4"
            >
              <h4 className="font-medium text-gray-900 mb-2">
                {categoryLabels[category as EvaluationCategory]}
              </h4>
              <div className="space-y-2">
                {evals.map((eval_) => {
                  // Get debate rounds for this criterion (for showing debate context)
                  const criterionDebates = rounds.filter(
                    (r) => r.criterion === eval_.criterion,
                  );
                  const hasDebateForCriterion = criterionDebates.length > 0;

                  // Get previous run score for comparison
                  const prevScore = previousScoresByCriterion.get(
                    eval_.criterion,
                  );
                  const hasPreviousScore = prevScore !== undefined;
                  const delta = hasPreviousScore
                    ? eval_.final_score - prevScore
                    : 0;

                  // Build debate summary from challenges that impacted the score
                  const debateChallenges = criterionDebates
                    .filter(
                      (r) =>
                        r.arbiter_verdict === "RED_TEAM" ||
                        r.arbiter_verdict === "DRAW",
                    )
                    .map((r) => r.redteam_challenge)
                    .filter((c): c is string => c !== null);

                  return (
                    <div
                      key={eval_.criterion}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">
                          {eval_.criterion
                            .split("_")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Show current score as the primary score */}
                          <span
                            className={`font-bold ${scoreInterpretation.getColor(
                              eval_.final_score,
                            )}`}
                          >
                            {eval_.final_score.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({Math.round(eval_.confidence * 100)}%)
                          </span>
                          {/* Show change from previous assessment if available */}
                          {hasPreviousScore && Math.abs(delta) >= 0.5 && (
                            <span className="text-xs text-gray-400">
                              (prev: {prevScore.toFixed(1)})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Show debate findings if there were challenges */}
                      {hasDebateForCriterion && debateChallenges.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">
                            Score adjusted after red team debate:
                          </p>
                          <ul className="text-sm text-gray-600 space-y-1 pl-4">
                            {debateChallenges.map((challenge, idx) => (
                              <li key={idx} className="list-disc text-gray-700">
                                {challenge}
                              </li>
                            ))}
                          </ul>
                          <details className="text-xs text-gray-500">
                            <summary className="cursor-pointer hover:text-gray-700">
                              View assessment reasoning
                            </summary>
                            <p className="mt-1 text-gray-600 pl-2 border-l-2 border-gray-200">
                              {eval_.reasoning}
                            </p>
                          </details>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">
                          {eval_.reasoning}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
