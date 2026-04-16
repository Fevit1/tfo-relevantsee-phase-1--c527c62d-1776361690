'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import Spinner from '@/components/ui/Spinner'

const SCORE_RING_COLOR = (score) => {
  if (score === null || score === undefined) return '#4b5563' // gray-600
  if (score >= 85) return '#10b981' // green-500
  if (score >= 70) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

const SCORE_TEXT_COLOR = (score) => {
  if (score === null || score === undefined) return 'text-gray-400'
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-red-400'
}

const SCORE_LABEL = (score) => {
  if (score === null || score === undefined) return 'Not scored'
  if (score >= 85) return 'Meets brand standards'
  if (score >= 70) return 'Needs improvement'
  return 'Below brand standards'
}

export default function BrandScoreWidget({ campaignId, initialScore, onScoreUpdate, userRole }) {
  const toast = useToast()
  const [score, setScore] = useState(initialScore ?? null)
  const [scoreData, setScoreData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleScore = async () => {
    if (!campaignId) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/campaigns/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId }),
      })

      if (res.status === 429) {
        setError('Scoring rate limit reached. Please wait before scoring again.')
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Scoring failed. Please try again.')
        return
      }

      const newScore = data.brand_score ?? data.final_score
      setScore(newScore)
      setScoreData(data)
      onScoreUpdate?.(newScore)
      toast.success(`Brand score: ${newScore}/100`)
    } catch (err) {
      if (!navigator.onLine) {
        setError('You appear to be offline. Check your connection and try again.')
      } else {
        setError('Scoring failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // SVG ring params
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = score !== null ? Math.max(0, Math.min(100, score)) / 100 : 0
  const dash = progress * circumference
  const gap = circumference - dash
  const ringColor = SCORE_RING_COLOR(score)

  const isBelowGate = score !== null && score < 85
  const isAboveGate = score !== null && score >= 85

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Brand Score</h3>
        {isAboveGate && (
          <span className="text-xs text-green-400 font-medium bg-green-900/30 px-2 py-0.5 rounded-full">
            ✓ Ready to submit
          </span>
        )}
      </div>

      {/* Score Ring */}
      <div className="flex items-center gap-5 mb-4">
        <div className="relative flex-shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90" aria-hidden="true">
            {/* Background ring */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke="#374151"
              strokeWidth="8"
            />
            {/* Progress ring */}
            <circle
              cx="48" cy="48" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${SCORE_TEXT_COLOR(score)}`} aria-label={`Brand score: ${score ?? 'not scored'}`}>
              {score !== null ? score : '—'}
            </span>
          </div>
        </div>

        <div>
          <p className={`text-sm font-medium ${SCORE_TEXT_COLOR(score)}`}>
            {SCORE_LABEL(score)}
          </p>
          {score !== null && (
            <p className="text-xs text-gray-500 mt-0.5