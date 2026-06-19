import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Share2, RotateCcw, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import type { PostureReport, ZoneResult } from '../analysis/postureEngine'
import { generatePDF } from '../utils/pdfGenerator'

const gradeColors: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  Excellent: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: '#10b981' },
  Good:      { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    ring: '#3b82f6' },
  Fair:      { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   ring: '#f59e0b' },
  Poor:      { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     ring: '#ef4444' }
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const [animScore, setAnimScore] = useState(0)
  const color = gradeColors[grade]?.ring ?? '#10b981'
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animScore / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => setAnimScore(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12"/>
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px', transition: 'stroke-dashoffset 1.2s ease-out' }}
        />
        <text x="70" y="64" textAnchor="middle" fontSize="30" fontWeight="700" fill={color}>{animScore}</text>
        <text x="70" y="82" textAnchor="middle" fontSize="13" fill="#94a3b8">/100</text>
      </svg>
      <div className={`text-sm font-semibold ${gradeColors[grade]?.text ?? 'text-gray-700'} mt-1`}>{grade}</div>
    </div>
  )
}

function ZoneCard({ zone }: { zone: ZoneResult }) {
  const [expanded, setExpanded] = useState(false)
  const colors = gradeColors[zone.grade]

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      <button
        className="w-full p-4 flex items-center gap-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900">{zone.name}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
              {zone.grade}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{zone.issue}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${colors.text}`}>{zone.score}</span>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 text-sm text-gray-600 border-t border-white/50 pt-3">
          {zone.detail}
        </div>
      )}
    </div>
  )
}

export default function Report() {
  const navigate = useNavigate()
  const [report, setReport] = useState<PostureReport | null>(null)
  const [showAnnotated, setShowAnnotated] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('postureReport')
    if (!stored) { navigate('/capture'); return }
    try { setReport(JSON.parse(stored)) } catch { navigate('/capture') }
  }, [navigate])

  if (!report) return null

  const handlePDF = async () => {
    setPdfLoading(true)
    try { await generatePDF(report) } finally { setPdfLoading(false) }
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `My PostureCheck report:\n\nScore: ${report.overallScore}/100 (${report.overallGrade})\nPosture type: ${report.postureType}\n\n${report.summary.slice(0, 200)}...\n\nCheck your posture free: ${window.location.origin}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleShare = async () => {
    setSharing(true)
    const text = `My posture score: ${report.overallScore}/100 (${report.overallGrade}) — ${report.postureType}. Check yours free at PostureCheck!`
    if (navigator.share) {
      await navigator.share({ title: 'My PostureCheck Report', text, url: window.location.origin }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${text} ${window.location.origin}`).catch(() => {})
    }
    setSharing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50" ref={reportRef}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="7" r="4" fill="white"/>
              <line x1="16" y1="11" x2="16" y2="25" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="10" y1="17" x2="22" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="16" y1="25" x2="11" y2="31" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="16" y1="25" x2="21" y2="31" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-gray-900">Posture Report</span>
        </div>
        <button onClick={() => navigate('/capture')} className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
          <RotateCcw size={14} /> Scan again
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Score + posture type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-5">
            <ScoreRing score={report.overallScore} grade={report.overallGrade} />
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">Overall posture score</div>
              <div className="text-2xl font-bold text-gray-900">{report.overallScore}<span className="text-sm text-gray-400 font-normal">/100</span></div>
              <div className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full mt-2 ${gradeColors[report.overallGrade]?.bg} ${gradeColors[report.overallGrade]?.text}`}>
                {report.overallGrade}
              </div>
              <div className="mt-2">
                <div className="text-xs text-gray-400">Posture type</div>
                <div className="text-sm font-semibold text-gray-900">{report.postureType}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Posture type description */}
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="text-xs font-semibold text-purple-600 mb-1 uppercase tracking-wide">About your posture type</div>
          <p className="text-sm text-purple-900 leading-relaxed">{report.postureTypeDescription}</p>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</div>
          <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
        </div>

        {/* Zone breakdown */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Zone breakdown</div>
          <div className="space-y-2">
            {report.zones.map(zone => <ZoneCard key={zone.name} zone={zone} />)}
          </div>
        </div>

        {/* Annotated photo */}
        {report.annotatedImageUrl && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-900">Annotated photo</span>
              <button
                onClick={() => setShowAnnotated(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
              >
                {showAnnotated ? <EyeOff size={14} /> : <Eye size={14} />}
                {showAnnotated ? 'Hide overlay' : 'Show overlay'}
              </button>
            </div>
            {showAnnotated && (
              <img
                src={report.annotatedImageUrl}
                alt="Posture analysis overlay"
                className="w-full object-contain max-h-96"
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePDF}
            disabled={pdfLoading}
            className="flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-3.5 font-medium text-sm hover:bg-gray-800 disabled:opacity-60 active:scale-95 transition-all"
          >
            <Download size={16} /> {pdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-3.5 font-medium text-sm hover:bg-green-600 active:scale-95 transition-all"
          >
            <Share2 size={16} /> Share on WhatsApp
          </button>
        </div>

        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 rounded-xl py-3.5 font-medium text-sm hover:bg-gray-50 active:scale-95 transition-all"
        >
          <Share2 size={16} /> {sharing ? 'Copied!' : 'Share report link'}
        </button>

        {/* Phrapy CTA */}
        <div className="bg-emerald-500 rounded-2xl p-5 text-white">
          <div className="text-xs font-semibold opacity-80 mb-1">Want professional help?</div>
          <div className="text-lg font-bold mb-1">Visit Phrapy Physiotherapy</div>
          <p className="text-sm opacity-90 mb-3">Our expert physiotherapists in Wakad, Pune can give you a full clinical assessment and personalised treatment plan.</p>
          <a
            href="https://wa.me/919999999999?text=Hi%2C%20I%20used%20PostureCheck%20and%20want%20to%20book%20a%20physiotherapy%20consultation"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-white text-emerald-700 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            Book a consultation
          </a>
        </div>

        {/* Metrics table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-900">Raw measurements</span>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { label: 'Head forward angle', value: `${report.metrics.headForwardAngle}°`, ideal: '< 5°' },
              { label: 'Shoulder tilt', value: `${report.metrics.shoulderTilt}%`, ideal: '< 2%' },
              { label: 'Pelvic tilt', value: `${report.metrics.pelvicTilt}°`, ideal: '< 5°' },
              { label: 'Spinal deviation', value: `${report.metrics.spinalDeviation}%`, ideal: '< 3%' },
              { label: 'Knee angle', value: `${report.metrics.kneeAngle}°`, ideal: '170–180°' },
            ].map(({ label, value, ideal }) => (
              <div key={label} className="flex items-center px-4 py-3">
                <span className="text-sm text-gray-600 flex-1">{label}</span>
                <span className="text-sm font-semibold text-gray-900 mr-3">{value}</span>
                <span className="text-xs text-gray-400">ideal {ideal}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 leading-relaxed">
          <strong>Medical disclaimer:</strong> This report is generated by AI for informational purposes only and does not constitute medical advice. Results should be reviewed by a qualified physiotherapist. Do not use this as the sole basis for diagnosis or treatment.
        </div>

        <div className="text-center text-xs text-gray-300 pb-4">
          PostureCheck · All analysis is done on your device · No data is stored or uploaded
        </div>
      </div>
    </div>
  )
}
