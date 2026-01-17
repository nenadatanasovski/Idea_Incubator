import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, X, ArrowUpDown } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useIdeas } from "../hooks/useIdeas";
import { useCategoryScores } from "../hooks/useEvaluations";
import { scoreInterpretation, categoryWeights } from "../types";
import type {
  IdeaWithScores,
  EvaluationCategory,
  CategoryScore,
} from "../types";
import clsx from "clsx";

const categoryLabels: Record<EvaluationCategory, string> = {
  problem: "Problem",
  solution: "Solution",
  feasibility: "Feasibility",
  fit: "Fit",
  market: "Market",
  risk: "Risk",
};

const COLORS = ["#0ea5e9", "#f97316", "#22c55e", "#a855f7"];

interface ComparisonIdea {
  idea: IdeaWithScores;
  scores: CategoryScore[];
  weightedAvg: number;
}

function IdeaSelector({
  ideas,
  selectedSlugs,
  onSelect,
}: {
  ideas: IdeaWithScores[];
  selectedSlugs: string[];
  onSelect: (slug: string) => void;
}) {
  const availableIdeas = ideas.filter(
    (i) => !selectedSlugs.includes(i.slug) && i.avg_final_score !== null,
  );

  if (availableIdeas.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">
        No more evaluated ideas available
      </p>
    );
  }

  return (
    <select
      className="input"
      onChange={(e) => {
        if (e.target.value) {
          onSelect(e.target.value);
          e.target.value = "";
        }
      }}
      defaultValue=""
    >
      <option value="">Select an idea to compare...</option>
      {availableIdeas.map((idea) => (
        <option key={idea.slug} value={idea.slug}>
          {idea.title} ({idea.avg_final_score?.toFixed(1) || "N/A"})
        </option>
      ))}
    </select>
  );
}

function ComparisonCard({
  comparisonIdea,
  index,
  onRemove,
}: {
  comparisonIdea: ComparisonIdea;
  index: number;
  onRemove: () => void;
}) {
  const { idea, weightedAvg } = comparisonIdea;

  return (
    <div className="card relative">
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        title="Remove from comparison"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: COLORS[index % COLORS.length] }}
        />
        <Link
          to={`/ideas/${idea.slug}`}
          className="font-medium text-gray-900 hover:text-primary-600"
        >
          {idea.title}
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{idea.idea_type}</span>
        <div className="text-right">
          <div
            className={`text-2xl font-bold ${scoreInterpretation.getColor(weightedAvg)}`}
          >
            {weightedAvg.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">
            {scoreInterpretation.getLevel(weightedAvg)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonTable({
  comparisonIdeas,
  sortConfig,
  onSort,
}: {
  comparisonIdeas: ComparisonIdea[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  onSort: (key: string) => void;
}) {
  const categories: EvaluationCategory[] = [
    "problem",
    "solution",
    "feasibility",
    "fit",
    "market",
    "risk",
  ];

  const getScoreForCategory = (
    compIdea: ComparisonIdea,
    category: EvaluationCategory,
  ): number => {
    const catScore = compIdea.scores.find((s) => s.category === category);
    return catScore?.avg_score ?? 0;
  };

  const sortedIdeas = useMemo(() => {
    const sorted = [...comparisonIdeas];
    sorted.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (sortConfig.key === "overall") {
        aVal = a.weightedAvg;
        bVal = b.weightedAvg;
      } else {
        aVal = getScoreForCategory(a, sortConfig.key as EvaluationCategory);
        bVal = getScoreForCategory(b, sortConfig.key as EvaluationCategory);
      }

      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [comparisonIdeas, sortConfig]);

  const SortButton = ({
    columnKey,
    label,
  }: {
    columnKey: string;
    label: string;
  }) => (
    <button
      onClick={() => onSort(columnKey)}
      className={clsx(
        "flex items-center gap-1 hover:text-gray-900",
        sortConfig.key === columnKey
          ? "text-primary-600 font-medium"
          : "text-gray-600",
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
              Idea
            </th>
            {categories.map((cat) => (
              <th key={cat} className="px-4 py-3 text-center text-sm">
                <SortButton columnKey={cat} label={categoryLabels[cat]} />
              </th>
            ))}
            <th className="px-4 py-3 text-center text-sm">
              <SortButton columnKey="overall" label="Overall" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedIdeas.map((compIdea, idx) => (
            <tr
              key={compIdea.idea.slug}
              className="border-b border-gray-100 last:border-0"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <Link
                    to={`/ideas/${compIdea.idea.slug}`}
                    className="text-sm font-medium text-gray-900 hover:text-primary-600"
                  >
                    {compIdea.idea.title}
                  </Link>
                </div>
              </td>
              {categories.map((cat) => {
                const score = getScoreForCategory(compIdea, cat);
                return (
                  <td key={cat} className="px-4 py-3 text-center">
                    <span
                      className={`font-medium ${scoreInterpretation.getColor(score)}`}
                    >
                      {score.toFixed(1)}
                    </span>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-center">
                <span
                  className={`font-bold ${scoreInterpretation.getColor(compIdea.weightedAvg)}`}
                >
                  {compIdea.weightedAvg.toFixed(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useCategoryScoresMultiple(slugs: string[]) {
  // This hook fetches scores for multiple ideas
  // We'll use individual hooks and combine them
  const slug1 = slugs[0];
  const slug2 = slugs[1];
  const slug3 = slugs[2];
  const slug4 = slugs[3];

  const { scores: scores1, loading: loading1 } = useCategoryScores(slug1);
  const { scores: scores2, loading: loading2 } = useCategoryScores(slug2);
  const { scores: scores3, loading: loading3 } = useCategoryScores(slug3);
  const { scores: scores4, loading: loading4 } = useCategoryScores(slug4);

  const allScores: Record<string, CategoryScore[]> = {};
  if (slug1 && scores1.length > 0) allScores[slug1] = scores1;
  if (slug2 && scores2.length > 0) allScores[slug2] = scores2;
  if (slug3 && scores3.length > 0) allScores[slug3] = scores3;
  if (slug4 && scores4.length > 0) allScores[slug4] = scores4;

  return {
    scoresBySlug: allScores,
    loading: loading1 || loading2 || loading3 || loading4,
  };
}

export default function Comparison() {
  const { ideas, loading: ideasLoading } = useIdeas();
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({
    key: "overall",
    direction: "desc",
  });

  const { scoresBySlug, loading: scoresLoading } =
    useCategoryScoresMultiple(selectedSlugs);

  const comparisonIdeas: ComparisonIdea[] = useMemo(() => {
    return selectedSlugs
      .map((slug) => {
        const idea = ideas.find((i) => i.slug === slug);
        const scores = scoresBySlug[slug] || [];

        if (!idea) return null;

        const weightedAvg = scores.reduce((acc, cat) => {
          const weight =
            categoryWeights[cat.category as EvaluationCategory] || 0;
          return acc + cat.avg_score * weight;
        }, 0);

        return { idea, scores, weightedAvg };
      })
      .filter((x): x is ComparisonIdea => x !== null);
  }, [selectedSlugs, ideas, scoresBySlug]);

  const radarData = useMemo(() => {
    const categories: EvaluationCategory[] = [
      "problem",
      "solution",
      "feasibility",
      "fit",
      "market",
      "risk",
    ];

    return categories.map((cat) => {
      const point: Record<string, any> = {
        category: categoryLabels[cat],
        fullMark: 10,
      };

      comparisonIdeas.forEach((compIdea, idx) => {
        const catScore = compIdea.scores.find((s) => s.category === cat);
        point[`idea${idx}`] = catScore?.avg_score ?? 0;
      });

      return point;
    });
  }, [comparisonIdeas]);

  const handleAddIdea = (slug: string) => {
    if (selectedSlugs.length < 4) {
      setSelectedSlugs([...selectedSlugs, slug]);
    }
  };

  const handleRemoveIdea = (slug: string) => {
    setSelectedSlugs(selectedSlugs.filter((s) => s !== slug));
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  if (ideasLoading) {
    return (
      <div className="card">
        <p className="text-gray-500">Loading ideas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/ideas"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to ideas
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Compare Ideas</h1>
        <p className="text-gray-600 mt-1">
          Select up to 4 evaluated ideas to compare side-by-side
        </p>
      </div>

      {/* Idea Selector */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Plus className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <IdeaSelector
              ideas={ideas}
              selectedSlugs={selectedSlugs}
              onSelect={handleAddIdea}
            />
          </div>
          <span className="text-sm text-gray-500">
            {selectedSlugs.length}/4 selected
          </span>
        </div>
      </div>

      {/* Selected Ideas Cards */}
      {comparisonIdeas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {comparisonIdeas.map((compIdea, idx) => (
            <ComparisonCard
              key={compIdea.idea.slug}
              comparisonIdea={compIdea}
              index={idx}
              onRemove={() => handleRemoveIdea(compIdea.idea.slug)}
            />
          ))}
        </div>
      )}

      {/* Comparison Content */}
      {comparisonIdeas.length >= 2 && !scoresLoading && (
        <>
          {/* Radar Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Category Comparison
            </h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                <RadarChart
                  data={radarData}
                  margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
                >
                  <PolarGrid />
                  <PolarAngleAxis
                    dataKey="category"
                    tick={{ fill: "#374151", fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 10]}
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                  />
                  {comparisonIdeas.map((compIdea, idx) => (
                    <Radar
                      key={compIdea.idea.slug}
                      name={compIdea.idea.title}
                      dataKey={`idea${idx}`}
                      stroke={COLORS[idx % COLORS.length]}
                      fill={COLORS[idx % COLORS.length]}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Table */}
          <ComparisonTable
            comparisonIdeas={comparisonIdeas}
            sortConfig={sortConfig}
            onSort={handleSort}
          />

          {/* Winner Analysis */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Analysis Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Overall Winner */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-800 mb-2">
                  Highest Overall Score
                </h4>
                {(() => {
                  const winner = [...comparisonIdeas].sort(
                    (a, b) => b.weightedAvg - a.weightedAvg,
                  )[0];
                  return (
                    <div>
                      <p className="font-semibold text-green-900">
                        {winner.idea.title}
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {winner.weightedAvg.toFixed(1)}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Category Leaders */}
              {(["problem", "solution", "market"] as EvaluationCategory[]).map(
                (cat) => {
                  const leader = [...comparisonIdeas].sort((a, b) => {
                    const aScore =
                      a.scores.find((s) => s.category === cat)?.avg_score ?? 0;
                    const bScore =
                      b.scores.find((s) => s.category === cat)?.avg_score ?? 0;
                    return bScore - aScore;
                  })[0];
                  const leaderScore =
                    leader.scores.find((s) => s.category === cat)?.avg_score ??
                    0;

                  return (
                    <div
                      key={cat}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <h4 className="text-sm font-medium text-gray-600 mb-2">
                        Best {categoryLabels[cat]}
                      </h4>
                      <p className="font-semibold text-gray-900">
                        {leader.idea.title}
                      </p>
                      <p
                        className={`text-xl font-bold ${scoreInterpretation.getColor(leaderScore)}`}
                      >
                        {leaderScore.toFixed(1)}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {comparisonIdeas.length < 2 && (
        <div className="card text-center py-12">
          <p className="text-gray-500">Select at least 2 ideas to compare</p>
          <p className="text-sm text-gray-400 mt-1">
            Only ideas that have been evaluated can be compared
          </p>
        </div>
      )}
    </div>
  );
}
