import { useState, useEffect, useCallback } from 'react'
import type { UserProfileSummary } from '../types'
import { getProfiles, getIdeaProfile, linkProfileToIdea, unlinkProfileFromIdea } from '../api/client'

export function useProfiles() {
  const [profiles, setProfiles] = useState<UserProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    getProfiles()
      .then(setProfiles)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  const refetch = useCallback(() => {
    getProfiles().then(setProfiles).catch(setError)
  }, [])

  return { profiles, loading, error, refetch }
}

export function useIdeaProfile(slug: string | undefined) {
  const [profile, setProfile] = useState<UserProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchProfile = useCallback(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    getIdeaProfile(slug)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const link = useCallback(async (profileId: string) => {
    if (!slug) return
    await linkProfileToIdea(profileId, slug)
    fetchProfile()
  }, [slug, fetchProfile])

  const unlink = useCallback(async () => {
    if (!slug || !profile) return
    await unlinkProfileFromIdea(profile.id, slug)
    setProfile(null)
  }, [slug, profile])

  return { profile, loading, error, refetch: fetchProfile, link, unlink }
}
