'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ChannelSkeleton from '@/components/campaigns/ChannelSkeleton'
import BrandScoreWidget from '@/components/campaigns/BrandScoreWidget'
import EmailPreviewFrame from '@/components/campaigns/EmailPreviewFrame'
import AdCopyPanel from '@/components/campaigns/AdCopyPanel'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useToast } from '@/components/ui/Toast'
import Spinner from '@/components/ui/Spinner'

const BRIEF_MAX = 2000
const VALID_CHANNELS = ['email', 'social', 'ads']

const CHANNEL_ICONS = {
  email: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  social: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
  ads: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
}

const GENERATION_STEPS = [
  { key: 'generating', label: 'Generating content', detail: 'AI is crafting your campaign (20–40s)', icon: '✨' },
  { key: 'scoring', label: 'Scoring brand alignment', detail: 'Analyzing against brand guidelines', icon: '🎯' },
]

function NewCampaignContent() {
  const router = useRouter()
  const toast = useToast()
  const abortControllerRef = useRef(null)

  const [step, setStep] = useState('form')
  const [campaign, setCampaign] = useState(null)
  const [generatedContent, setGeneratedContent] = useState(null)
  const [brandScore, setBrandScore] = useState(null)
  const [channelErrors, setChannelErrors] = useState([])

  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [channels, setChannels] = useState(['email'])
  const [formErrors, setFormErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [generationElapsed, setGenerationElapsed] = useState(0)
  const elapsedRef = useRef(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const briefOverLimit = brief.length > BRIEF_MAX
  const briefRemaining = BRIEF_MAX - brief.length

  const startElapsedTimer = () => {
    setGenerationElapsed(0)
    elapsedRef.current = setInterval(() => setGenerationElapsed(p => p + 1), 1000)
  }

  const stopElapsedTimer = () => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
  }

  const validateForm = () => {
    const errors = {}
    if (!name.trim()) errors.name = 'Campaign name is required.'
    if (!brief.trim()) errors.brief = 'Campaign brief is required.'
    else if (brief.length > BRIEF_MAX) errors.brief = `Brief must be under ${BRIEF_MAX} characters.`
    if (channels.length === 0) errors.channels = 'Select at least one channel.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const toggleChannel = (ch) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
    if (formErrors.channels) setFormErrors(p => ({ ...p, channels: undefined }))
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort()
    stopElapsedTimer()
    setStep('form')
    setIsCreating(false)
    toast.warning('Generation cancelled.')
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setApiError(null)
    if (!validateForm()) return
    setIsCreating(true)
    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), brief: brief.trim(), channels }),
        signal: abortControllerRef.current.signal,
      })
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 429) {
        setApiError('Rate limit reached. Please wait before creating another campaign.')
        setIsCreating(false)
        return
      }
      const data = await res.json()
      if (!res.ok) { setApiError(data.error || 'Failed to create campaign.'); setIsCreating(false); return }
      toast.success('Campaign created! Generating content...')
      setCampaign(data.campaign)
      await handleGenerate(data.campaign)
    } catch (err) {
      if (err.name === 'AbortError') return
      setApiError(navigator.onLine ? 'An unexpected error occurred.' : 'You appear to be offline.')
      setIsCreating(false)
    }
  }

  const handleGenerate = async (campaignRecord) => {
    const c = campaignRecord || campaign
    if (!c) return
    setStep('generating')
    setChannelErrors([])
    startElapsedTimer()
    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: c.id, channels: c.channels }),
        signal: abortControllerRef.current.signal,
      })
      stopElapsedTimer()
      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 429) { setApiError('Generation rate limit. Try again later.'); setStep('form'); return }
      const data = await res.json()
      if (!res.ok) { setApiError(data.error || 'Generation failed.'); setStep('form'); toast.error('Generation failed.'); return }
      setGeneratedContent(data.campaign.generated_content)
      setCampaign(data.campaign)
      if (data.channel_errors?.length) {
        setChannelErrors(data.channel_errors)
        toast.warning(`Issues with: ${data.channel_errors.map(e => e.channel).join(', ')}`)
      }
      toast.success('Content generated! Scoring...')
      setStep('scoring')
      await handleScore(c.id)
    } catch (err) {
      stopElapsedTimer()
      if (err.name === 'AbortError') return
      setApiError('Generation failed. Please try again.')
      setStep('form')
      toast.error('Generation failed.')
    }
  }

  const handleScore = async (campaignId) => {
    const cid = campaignId || campaign?.id
    if (!cid) return
    try {
      const res = await fetch('/api/campaigns/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: cid }),
      })
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      if (res.ok) {
        setBrandScore(data.brand_score)
        setCampaign(p => p ? { ...p, brand_score: data.brand_score } : p)
        toast.success(`Brand score: ${data.brand_score}/100`)
      } else {
        toast.warning('Scoring failed. Retry from the campaign page.')
      }
    } catch {
      toast.warning('Scoring failed. Retry from the campaign page.')
    } finally {
      setStep('done')
      setIsCreating(false)
    }
  }

  const handleRetryChannel = async (channel) => {
    if (!campaign) return
    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id, channels: [channel] }),
      })
      const data = await res.json()
      if (res.ok) {
        setGeneratedContent(p => ({ ...(p || {}), [channel]: data.campaign.generated_content?.[channel] }))
        setChannelErrors(p => p.filter(ce => ce.channel !== channel))
        toast.success(`${channel} content regenerated!`)
      } else {
        toast.error(`Failed to regenerate ${channel}.`)
      }
    } catch {
      toast.error(`Failed to regenerate ${channel}.`)
    }
  }

  const handleSubmit = async () => {
    if (!campaign) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/submit`, { method: 'POST' })
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error || 'Failed to submit.'); toast.error(data.error || 'Failed to submit.'); return }
      toast.success('Campaign submitted for approval!')
      router.push(`/campaigns/${campaign.id}`)
    } catch {
      setSubmitError('An unexpected error occurred.')
      toast.error('An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentStepInfo = GENERATION_STEPS.find(s => s.key === step)
  const currentStepIdx = GENERATION_STEPS.findIndex(s => s.key === step)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-200 text-sm transition-colors duration-150 group"
        >
          <svg className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </a>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 sm:mb-8 tracking-tight">New Campaign</h1>

      {/* Campaign Form */}
      {!campaign && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sm:p-6 mb-6 animate-fade-in-up shadow-card">
          <h2 className="text-base font-semibold text-white mb-5">Campaign Details</h2>

          {apiError && (
            <div className="mb-5 p-3.5 bg-red-900/20 border border-red-800/60 rounded-xl flex items-start gap-3 animate-fade-in" role="alert">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-red-300 text-sm">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleCreate} noValidate>
            <div className="space-y-5">
              {/* Campaign Name */}
              <div>
                <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Campaign Name <span className="text-red-400" aria-label="required">*</span>
                </label>
                <input
                  id="campaign-name"
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); if (formErrors.name) setFormErrors(p => ({ ...p, name: undefined })) }}
                  className={[
                    'input-base',
                    formErrors.name ? 'input-error' : '',
                  ].join(' ')}
                  placeholder="e.g. Spring Collection 2025"
                  aria-describedby={formErrors.name ? 'name-error' : undefined}
                  aria-invalid={!!formErrors.name}
                  autoComplete="off"
                />
                {formErrors.name && (
                  <p id="name-error" className="mt-1.5 text-red-400 text-xs flex items-center gap-1" role="alert">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {formErrors.name}
                  </p>
                )}
              </div>

              {/* Brief */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="campaign-brief" className="block text-sm font-medium text-gray-300">
                    Campaign Brief <span className="text-red-400" aria-label="required">*</span>
                  </label>
                  <span
                    className={`text-xs font-mono tabular-nums transition-colors duration-150 ${
                      briefOverLimit ? 'text-red-400 font-bold' : briefRemaining < 200 ? 'text-amber-400' : 'text-gray-600'
                    }`}
                    aria-live="polite"
                    aria-label={`${brief.length} of ${BRIEF_MAX} characters used`}
                  >
                    {brief.length}/{BRIEF_MAX}
                  </span>
                </div>
                <textarea
                  id="campaign-brief"
                  value={brief}
                  onChange={e => { setBrief(e.target.value); if (formErrors.brief) setFormErrors(p => ({ ...p, brief: undefined })) }}
                  rows={6}
                  className={[
                    'input-base resize-none',
                    formErrors.brief || briefOverLimit ? 'input-error' : '',
                  ].join(' ')}
                  placeholder="Describe your campaign objectives, target audience, key messages, and requirements..."
                  aria-describedby={`brief-count${formErrors.brief ? ' brief-error' : ''}`}
                  aria-invalid={!!(formErrors.brief || briefOverLimit)}
                />
                <p id="brief-count" className="sr-only">Maximum {BRIEF_MAX} characters</p>
                {(formErrors.brief || briefOverLimit) && (
                  <p id="brief-error" className="mt-1.5 text-red-400 text-xs flex items-center gap-1" role="alert">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {formErrors.brief || `Brief exceeds ${BRIEF_MAX} character limit`}
                  </p>
                )}
              </div>

              {/* Channels */}
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">
                  Channels <span className="text-red-400" aria-label="required">*</span>
                </p>
                <div className="flex gap-2 flex-wrap" role="group" aria-label="Select channels">
                  {VALID_CHANNELS.map(ch => {
                    const selected = channels.includes(ch)
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleChannel(ch)}
                        aria-pressed={selected}
                        className={[
                          'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                          'transition-all duration-150 border btn-press',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                          selected
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-glow-indigo/20'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600',
                        ].join(' ')}
                      >
                        {CHANNEL_ICONS[ch]}
                        {ch.charAt(0).toUpperCase() + ch.slice(1)}
                        {selected && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
                {formErrors.channels && (
                  <p className="mt-1.5 text-red-400 text-xs flex items-center gap-1" role="alert">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {formErrors.channels}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-800">
              <button
                type="submit"
                disabled={isCreating || briefOverLimit || channels.length === 0}
                className={[
                  'inline-flex items-center gap-2 px-6 py-2.5',
                  'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg',
                  'transition-all duration-150 btn-press',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
                ].join(' ')}
                aria-busy={isCreating}
              >
                {isCreating ? (
                  <><Spinner size="sm" />Creating & Generating...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Create & Generate Content
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Generation Loading State */}
      {(step === 'generating' || step === 'scoring') && campaign && (
        <div
          className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sm:p-6 mb-6 shadow-card animate-scale-in"
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          {/* Step progress */}
          <div className="flex items-center gap-3 mb-5">
            {GENERATION_STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                  s.key === step
                    ? 'bg-indigo-600 text-white shadow-glow-indigo/40'
                    : currentStepIdx > i
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-500',
                ].join(' ')}>
                  {currentStepIdx > i ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className={`text-xs hidden sm:block ${s.key === step ? 'text-white font-medium' : currentStepIdx > i ? 'text-green-400' : 'text-gray-600'}`}>
                  {s.label}
                </span>
                {i < GENERATION_STEPS.length - 1 && (
                  <div className={`hidden sm:block w-8 h-px ml-1 ${currentStepIdx > i ? 'bg-green-600' : 'bg-gray-700'}`} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white font-semibold">
                {currentStepInfo?.icon} {currentStepInfo?.label}
              </p>
              <p className="text-gray-500 text-sm mt-0.5">{currentStepInfo?.detail}</p>
              {step === 'generating' && generationElapsed > 0 && (
                <p className="text-gray-600 text-xs mt-1 tabular-nums">
                  {generationElapsed}s elapsed
                  {generationElapsed >= 20 && ' — almost there!'}
                </p>
              )}
            </div>
            {step === 'generating' && (
              <button
                onClick={handleCancel}
                className={[
                  'px-3 py-1.5 text-xs text-gray-500 hover:text-gray-200',
                  'border border-gray-700 hover:border-gray-500 rounded-lg',
                  'transition-all duration-150 btn-press',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500',
                ].join(' ')}
              >
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-2">
            {campaign.channels.map(ch => (
              <ChannelSkeleton key={ch} channel={ch} isScoring={step === 'scoring'} />
            ))}
          </div>
        </div>
      )}

      {/* Generated Content */}
      {step === 'done' && generatedContent && campaign && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Channel errors */}
          {channelErrors.length > 0 && (
            <div className="p-4 bg-amber-900/20 border border-amber-800/60 rounded-xl animate-fade-in">
              <p className="text-amber-300 text-sm font-medium mb-2">Some channels had issues:</p>
              <div className="space-y-1.5">
                {channelErrors.map(ce => (
                  <div key={ce.channel} className="flex items-center justify-between">
                    <p className="text-amber-400/80 text-xs capitalize">{ce.channel}: {ce.error}</p>
                    <button
                      onClick={() => handleRetryChannel(ce.channel)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors duration-150 ml-4"
                    >
                      Retry
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email */}
          {campaign.channels.includes('email') && generatedContent?.email && !generatedContent.email?.error && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sm:p-6 shadow-card">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                {CHANNEL_ICONS.email}
                Email Campaign
              </h3>
              <div className="space-y-3 mb-4">
                {generatedContent.email.subject_lines?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">Subject Lines</p>
                    <div className="space-y-1.5">
                      {generatedContent.email.subject_lines.map((sl, i) => (
                        <div key={i} className="px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-200 border border-gray-700/50">{sl}</div>
                      ))}
                    </div>
                  </div>
                )}
                {generatedContent.email.preview_text && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">Preview Text</p>
                    <div className="px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-200 border border-gray-700/50">{generatedContent.email.preview_text}</div>
                  </div>
                )}
              </div>
              {generatedContent.email.html_body && (
                <EmailPreviewFrame htmlBody={generatedContent.email.html_body} />
              )}
            </div>
          )}

          {/* Social */}
          {campaign.channels.includes('social') && generatedContent?.social && !generatedContent.social?.error && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sm:p-6 shadow-card">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                {CHANNEL_ICONS.social}
                Social Media
              </h3>
              <div className="space-y-4">
                {generatedContent.social.instagram && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">Instagram</p>
                    <div className="px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-200 whitespace-pre-wrap border border-gray-700/50">
                      {generatedContent.social.instagram.caption}
                    </div>
                    {generatedContent.social.instagram.hashtags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {generatedContent.social.instagram.hashtags.map((h, i) => (
                          <span key={i} className="text-indigo-400 text-xs">#{h}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {generatedContent.social.twitter && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">Twitter / X</p>
                    <div className="px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-200 border border-gray-700/50">
                      {generatedContent.social.twitter.post}
                    </div>
                  </div>
                )}
                {generatedContent.social.linkedin && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">LinkedIn</p>
                    <div className="px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-200 whitespace-pre-wrap border border-gray-700/50">
                      {generatedContent.social.linkedin.post}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ads */}
          {campaign.channels.includes('ads') && generatedContent?.ads && !generatedContent.ads?.error && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sm:p-6 shadow-card">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                {CHANNEL_ICONS.ads}
                Ad Copy
              </h3>
              <AdCopyPanel adsContent={generatedContent.ads} />
            </div>
          )}

          {/* Brand Score */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sm:p-6 shadow-card">
            <BrandScoreWidget
              campaignId={campaign.id}
              initialScore={brandScore}
              onScoreUpdate={(score) => {
                setBrandScore(score)
                setCampaign(p => p ? { ...p, brand_score: score } : p)
                toast.success(`Brand score: ${score}/100`)
              }}
            />
          </div>

          {/* Submit */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 sm:p-6 shadow-card">
            <h3 className="text-base font-semibold text-white mb-4">Ready to Submit?</h3>

            {submitError && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-800/60 rounded-xl animate-fade-in" role="alert">
                <p className="text-red-300 text-sm">{submitError}</p>
              </div>
            )}

            {brandScore === null && (
              <div className="mb-4 p-3 bg-amber-900/20 border border-amber-800/60 rounded-xl" role="status">
                <p className="text-amber-300 text-sm">⚠️ Score your content before submitting.</p>
              </div>
            )}

            {brandScore !== null && brandScore < 85 && (
              <div className="mb-4 p-3 bg-amber-900/20 border border-amber-800/60 rounded-xl" role="status">
                <p className="text-amber-300 text-sm">
                  ⚠️ Brand score must be ≥ 85 to submit. Current: <strong>{brandScore}</strong>
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || brandScore === null || brandScore < 85}
                className={[
                  'inline-flex items-center gap-2 px-6 py-2.5',
                  'bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg',
                  'transition-all duration-150 btn-press',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-