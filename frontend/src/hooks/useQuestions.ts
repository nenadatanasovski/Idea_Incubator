import { useState, useEffect, useCallback } from 'react'
import type {
  Question,
  Answer,
  ReadinessScore,
  CriterionCoverage,
  DevelopmentSession,
  QuestionsResponse,
  AnswerSubmitResponse,
} from '../types'
import {
  getQuestions,
  getAnswers,
  submitAnswer,
  deleteAnswer,
  getReadiness,
  getCriterionCoverage,
  startDevelopmentSession,
  getDevelopmentSession,
  getAllQuestions,
} from '../api/client'

interface UseQuestionsOptions {
  category?: string
  criterion?: string
  priority?: string
  unansweredOnly?: boolean
  limit?: number
}

export function useQuestions(slug: string | undefined, options?: UseQuestionsOptions) {
  const [data, setData] = useState<QuestionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchQuestions = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const result = await getQuestions(slug, options)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch questions'))
    } finally {
      setLoading(false)
    }
  }, [slug, options?.category, options?.criterion, options?.priority, options?.unansweredOnly, options?.limit])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    fetchQuestions()
  }, [slug, fetchQuestions])

  return {
    questions: data?.questions || [],
    answeredIds: data?.answeredIds || [],
    loading,
    error,
    refetch: fetchQuestions,
  }
}

export function useAllQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getAllQuestions()
      .then(setQuestions)
      .catch(err => setError(err instanceof Error ? err : new Error('Failed to fetch questions')))
      .finally(() => setLoading(false))
  }, [])

  return { questions, loading, error }
}

export function useAnswers(slug: string | undefined) {
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchAnswers = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const result = await getAnswers(slug)
      setAnswers(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch answers'))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    fetchAnswers()
  }, [slug, fetchAnswers])

  const submit = useCallback(async (
    questionId: string,
    answer: string,
    sessionId?: string
  ): Promise<AnswerSubmitResponse | null> => {
    if (!slug) return null
    try {
      const result = await submitAnswer(slug, { questionId, answer, sessionId })
      // Refetch answers to get updated list
      await fetchAnswers()
      return result
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to submit answer'))
      throw err
    }
  }, [slug, fetchAnswers])

  const remove = useCallback(async (questionId: string): Promise<void> => {
    if (!slug) return
    try {
      await deleteAnswer(slug, questionId)
      // Refetch answers to get updated list
      await fetchAnswers()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete answer'))
      throw err
    }
  }, [slug, fetchAnswers])

  return {
    answers,
    loading,
    error,
    refetch: fetchAnswers,
    submit,
    remove,
  }
}

export function useReadiness(slug: string | undefined) {
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null)
  const [coverage, setCoverage] = useState<CriterionCoverage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchReadiness = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const [readinessResult, coverageResult] = await Promise.all([
        getReadiness(slug),
        getCriterionCoverage(slug),
      ])
      setReadiness(readinessResult)
      setCoverage(coverageResult)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch readiness'))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    fetchReadiness()
  }, [slug, fetchReadiness])

  return {
    readiness,
    coverage,
    loading,
    error,
    refetch: fetchReadiness,
  }
}

export function useDevelopmentSession(slug: string | undefined) {
  const [session, setSession] = useState<DevelopmentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSession = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const result = await getDevelopmentSession(slug)
      setSession(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch session'))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    fetchSession()
  }, [slug, fetchSession])

  const start = useCallback(async (options?: {
    focusCategory?: string
    focusCriterion?: string
    questionsPerSession?: number
  }): Promise<DevelopmentSession | null> => {
    if (!slug) return null
    try {
      const result = await startDevelopmentSession(slug, options)
      setSession(result)
      setError(null)
      return result
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start session'))
      throw err
    }
  }, [slug])

  const end = useCallback(() => {
    setSession(null)
  }, [])

  return {
    session,
    loading,
    error,
    refetch: fetchSession,
    start,
    end,
  }
}

// Combined hook for a complete development experience
export function useDevelopment(slug: string | undefined) {
  const questions = useQuestions(slug)
  const answers = useAnswers(slug)
  const readiness = useReadiness(slug)
  const session = useDevelopmentSession(slug)

  const refetchAll = useCallback(async () => {
    await Promise.all([
      questions.refetch(),
      answers.refetch(),
      readiness.refetch(),
    ])
  }, [questions.refetch, answers.refetch, readiness.refetch])

  // Submit an answer and refetch readiness
  const submitAndUpdate = useCallback(async (
    questionId: string,
    answer: string,
    sessionId?: string
  ) => {
    const result = await answers.submit(questionId, answer, sessionId)
    // Refetch readiness after submitting
    await readiness.refetch()
    return result
  }, [answers.submit, readiness.refetch])

  return {
    questions: questions.questions,
    answeredIds: questions.answeredIds,
    answers: answers.answers,
    readiness: readiness.readiness,
    coverage: readiness.coverage,
    session: session.session,
    loading: questions.loading || answers.loading || readiness.loading,
    error: questions.error || answers.error || readiness.error || session.error,
    refetchAll,
    submitAnswer: submitAndUpdate,
    deleteAnswer: answers.remove,
    startSession: session.start,
    endSession: session.end,
  }
}
