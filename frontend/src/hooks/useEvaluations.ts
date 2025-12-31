import { useState, useEffect } from 'react'
import type {
  Evaluation,
  CategoryScore,
  DebateRound,
  RedTeamChallenge,
  Synthesis,
} from '../types'
import {
  getEvaluations,
  getCategoryScores,
  getEvaluationRuns,
  getDebateRounds,
  getRedTeamChallenges,
  getSynthesis,
} from '../api/client'

export function useEvaluations(slug: string | undefined, runId?: string) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)
    getEvaluations(slug, runId)
      .then(setEvaluations)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug, runId])

  return { evaluations, loading, error }
}

export function useCategoryScores(slug: string | undefined, runId?: string) {
  const [scores, setScores] = useState<CategoryScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)
    getCategoryScores(slug, runId)
      .then(setScores)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug, runId])

  return { scores, loading, error }
}

export function useEvaluationRuns(slug: string | undefined) {
  const [runs, setRuns] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)
    getEvaluationRuns(slug)
      .then(setRuns)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug])

  return { runs, loading, error }
}

export function useDebateRounds(slug: string | undefined, runId?: string) {
  const [rounds, setRounds] = useState<DebateRound[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)
    getDebateRounds(slug, runId)
      .then(setRounds)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug, runId])

  return { rounds, loading, error }
}

export function useRedTeamChallenges(slug: string | undefined, runId?: string) {
  const [challenges, setChallenges] = useState<RedTeamChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)
    getRedTeamChallenges(slug, runId)
      .then(setChallenges)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug, runId])

  return { challenges, loading, error }
}

export function useSynthesis(slug: string | undefined, runId?: string) {
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)
    getSynthesis(slug, runId)
      .then(setSynthesis)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug, runId])

  return { synthesis, loading, error }
}

/**
 * Hook to fetch scores from the previous evaluation run for comparison.
 * Returns null if there's no previous run (i.e., this is the first evaluation).
 */
export function usePreviousRunScores(slug: string | undefined, currentRunId?: string) {
  const [previousScores, setPreviousScores] = useState<CategoryScore[] | null>(null)
  const [previousRunId, setPreviousRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)

    // First get all evaluation runs
    getEvaluationRuns(slug)
      .then(async (runs) => {
        if (runs.length < 2) {
          // No previous run exists
          setPreviousScores(null)
          setPreviousRunId(null)
          return
        }

        // Determine which run is "previous"
        // runs are ordered DESC by date (newest first)
        let prevRunId: string

        if (currentRunId) {
          // Find the run that comes after currentRunId in the list (i.e., older)
          const currentIndex = runs.indexOf(currentRunId)
          if (currentIndex === -1 || currentIndex === runs.length - 1) {
            // Current run not found or is the oldest - no previous
            setPreviousScores(null)
            setPreviousRunId(null)
            return
          }
          prevRunId = runs[currentIndex + 1]
        } else {
          // No currentRunId specified, assume viewing latest (runs[0])
          // Previous would be runs[1]
          prevRunId = runs[1]
        }

        setPreviousRunId(prevRunId)

        // Fetch scores for the previous run
        const scores = await getCategoryScores(slug, prevRunId)
        setPreviousScores(scores)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug, currentRunId])

  return { previousScores, previousRunId, loading, error }
}
