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
