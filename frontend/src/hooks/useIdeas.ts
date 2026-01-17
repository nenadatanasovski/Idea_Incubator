import { useState, useEffect } from "react";
import type { IdeaWithScores, IdeaFilters } from "../types";
import { getIdeas, getIdea } from "../api/client";

export function useIdeas(filters?: IdeaFilters) {
  const [ideas, setIdeas] = useState<IdeaWithScores[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log("useIdeas fetching with filters:", filters);
    setLoading(true);
    getIdeas(filters)
      .then(setIdeas)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [
    filters?.type,
    filters?.stage,
    filters?.tag,
    filters?.search,
    filters?.sortBy,
    filters?.sortOrder,
  ]);

  return {
    ideas,
    loading,
    error,
    refetch: () => getIdeas(filters).then(setIdeas),
  };
}

export function useIdea(slug: string | undefined) {
  const [idea, setIdea] = useState<IdeaWithScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIdea = () => {
    if (!slug) return;
    setLoading(true);
    getIdea(slug)
      .then(setIdea)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    fetchIdea();
  }, [slug]);

  const refetch = () => {
    if (slug) {
      getIdea(slug).then(setIdea).catch(setError);
    }
  };

  return { idea, loading, error, refetch };
}
