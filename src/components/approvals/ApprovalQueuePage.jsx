'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BrandScoreBadge } from '@/components/ui/BrandScoreBadge'
import { ChannelChips } from '@/components/ui/ChannelChips'
import { Modal } from '@/components/ui/Modal'
import { getApprovalQueue, approveCampaign, rejectCampaign } from '@/lib/api'

export function ApprovalQueuePage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [approveNotes, setApproveNotes] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [overrideNotes, setOverrideNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getApprovalQueue()
      setCampaigns(result.campaigns || [])
    } catch (err) {
      setError(err.message || 'Failed to load approval queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  const openApprove = (campaign) => {
    setSelectedCampaign(campaign)
    setApproveNotes('')
    setActionError(null)
    setApproveModalOpen(true)
  }

  const openReject = (campaign) => {
    setSelectedCampaign(campaign)
    setRejectNotes('')
    setActionError(null)
    setRejectModalOpen(true)
  }

  const openOverride = (campaign) => {
    setSelectedCampaign(campaign)
    setOverrideNotes('')
    setActionError(null)
    setOverrideModalOpen(true)
  }

  const handleApprove = async (override = false) => {
    if (!selectedCampaign) return
    setActionLoading(true)
    setActionError(null)
    try {
      const notes = override ? overrideNotes : approveNotes
      await approveCampaign(selectedCampaign.id, { notes, override_flag: override })
      setApproveModalOpen(false)
      setOverrideModalOpen(false)
      await loadQueue()
    } catch (err) {
      setActionError(err.message || 'Failed to approve')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedCampaign || !rejectNotes.trim()) {
      setActionError('Rejection notes are required')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      await rejectCampaign(selectedCampaign.id, { notes: rejectNotes })
      setRejectModalOpen(false)
      await loadQueue()
    } catch (err) {
      setActionError(err.message || 'Failed to reject')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <Layout>
        <div className="p-6 lg:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
            <p className="text-sm text-gray-400 mt-0.5">Review and approve pending campaigns</p>
          </div>

          {loading ? (
            <QueueSkeleton />
          ) : error ? (
            <div className="bg-gray-900 border border-red-900/50 rounded-xl p-8 text-center">
              <p className="text-red-400">{error}</p>
              <button onClick={loadQueue} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300">Retry</button>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-white font-semibold">All clear!</p>
              <p className="text-sm text-gray-400 mt-1">No campaigns pending approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} awaiting review</p>
              {campaigns.map(campaign => (
                <div key={campaign.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className="text-base font-semibold text-white hover:text-indigo-300 cursor-pointer transition-colors"
                          onClick={() => router.push(`/campaigns/${campaign.id}`)}
                        >
                          {campaign.name}
                        </h3>
                        <StatusBadge status={campaign.status} />
                        <BrandScoreBadge score={campaign.brand_score} />
                      </div>
                      <p className="text-sm text-gray-400 mt-1.5 line-clamp-2">{campaign.brief}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <ChannelChips channels={campaign.channels || []} />
                        <span className="text-xs text-gray-500">Submitted {formatDate(campaign.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                      <button
                        onClick={() => router.push(`/campaigns/${campaign.id}`)}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => openApprove(campaign)}
                        className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors"
                      >
                        Approve
                      </button>
                      {(campaign.brand_score === null || campaign.brand_score < 85) && (
                        <button
                          onClick={() => openOverride(campaign)}
                          className="px-3 py-1.5 text-sm text-amber-200 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800 rounded-lg transition-colors"
                        >
                          Override
                        </button>
                      )}
                      <button
                        onClick={() => openReject(campaign)}
                        className="px-3 py-1.5 text-sm text-red-300 bg-red-950/40 hover:bg-red-950/60 border border-red-900 rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approve modal */}
        <Modal open={approveModalOpen} onClose={() => setApproveModalOpen(false)} title="Approve Campaign">
          <div className="space-y-4">
            {actionError && <p className="text-sm text-red-400">{actionError}</p>}
            <p className="text-sm text-gray-300">Approving <strong className="text-white">{selectedCampaign?.name}</strong>.</p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Notes (optional)</label>
              <textarea
                value={approveNotes}
                onChange={e => setApproveNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes for the creator..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setApproveModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => handleApprove(false)} disabled={actionLoading} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg transition-colors">
                {actionLoading ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Override modal */}
        <Modal open={overrideModalOpen} onClose={() => setOverrideModalOpen(false)} title="Approve with Override">
          <div className="space-y-4">
            {actionError && <p className="text-sm text-red-400">{actionError}</p>}
            <div className="rounded-lg bg-amber-950/30 border border-amber-800 p-3">
              <p className="text-sm text-amber-300">
                Brand score ({selectedCampaign?.brand_score ?? '—'}) is below 85.
                Override requires a documented reason.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Override Reason <span className="text-red-400">*</span></label>
              <textarea
                value={overrideNotes}
                onChange={e => setOverrideNotes(e.target.value)}
                rows={3}
                placeholder="Explain the override..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOverrideModalOpen(false)} className="px-4 py-2