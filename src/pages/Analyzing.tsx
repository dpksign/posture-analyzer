import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadModel, analyzePosture } from '../analysis/postureEngine'

const steps = [
  'Loading AI model...',
  'Detecting body landmarks...',
  'Computing posture angles...',
  'Calculating zone scores...',
  'Generating your report...'
]

export default function Analyzing() {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const imageDataUrl = sessionStorage.getItem('capturedImage')
    if (!imageDataUrl) { navigate('/capture'); return }

    let stepTimer: ReturnType<typeof setInterval>
    let cancelled = false

    const run = async () => {
      stepTimer = setInterval(() => {
        setStepIndex(i => Math.min(i + 1, steps.length - 1))
      }, 600)

      try {
        await loadModel()
        if (cancelled) return

        const img = new Image()
        img.src = imageDataUrl
        await new Promise<void>((res, rej) => {
          img.onload = () => res()
          img.onerror = () => rej(new Error('Failed to load image'))
        })

        const report = await analyzePosture(img)
        if (cancelled) return

        clearInterval(stepTimer)
        setStepIndex(steps.length - 1)
        sessionStorage.setItem('postureReport', JSON.stringify(report))
        setTimeout(() => navigate('/report'), 500)
      } catch (err) {
        if (cancelled) return
        clearInterval(stepTimer)
        setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
      }
    }

    run()
    return () => { cancelled = true; clearInterval(stepTimer) }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Analysis failed</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => navigate('/capture')}
          className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-600"
        >
          Try again
        </button>
      </div>
    )
  }

  const progress = ((stepIndex + 1) / steps.length) * 100

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        {/* Animated icon */}
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8">
          <svg width="40" height="40" viewBox="0 0 40 40" className="animate-pulse">
            <circle cx="20" cy="8" r="5" fill="#10b981"/>
            <line x1="20" y1="13" x2="20" y2="30" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="12" y1="20" x2="28" y2="20" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="20" y1="30" x2="14" y2="38" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
            <line x1="20" y1="30" x2="26" y2="38" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">Analysing your posture</h2>
        <p className="text-gray-400 text-sm mb-8">This takes about 5–10 seconds</p>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
          <div
            className="h-2 bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step} className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${i <= stepIndex ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
                i < stepIndex ? 'bg-emerald-500' : i === stepIndex ? 'bg-emerald-200' : 'bg-gray-100'
              }`}>
                {i < stepIndex && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {i === stepIndex && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
              </div>
              <span className={i <= stepIndex ? 'text-gray-700' : 'text-gray-300'}>{step}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-300 mt-8">All processing happens on your device. No photos are uploaded.</p>
      </div>
    </div>
  )
}
