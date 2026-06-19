import { useNavigate } from 'react-router-dom'
import { Camera, FileText, Star, Shield, Zap, Users } from 'lucide-react'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="7" r="4" fill="white"/>
              <line x1="16" y1="11" x2="16" y2="25" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="10" y1="17" x2="22" y2="17" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="16" y1="25" x2="11" y2="31" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="16" y1="25" x2="21" y2="31" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-semibold text-gray-900">PostureCheck</span>
        </div>
        <button
          onClick={() => navigate('/capture')}
          className="bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
        >
          Try free
        </button>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-16 pb-12 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          100% free · No login required · On-device AI
        </div>
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          Check your posture in <span className="text-emerald-500">30 seconds</span>
        </h1>
        <p className="text-gray-500 text-lg mb-8 leading-relaxed">
          AI-powered posture analysis using your phone camera. Get an instant scored report with insights on your head, spine, shoulders and more.
        </p>
        <button
          onClick={() => navigate('/capture')}
          className="bg-emerald-500 text-white text-lg font-medium px-8 py-4 rounded-xl hover:bg-emerald-600 transition-all active:scale-95 w-full sm:w-auto"
        >
          Scan my posture — it's free
        </button>
        <p className="text-gray-400 text-sm mt-3">No login · No data upload · Results in 30 seconds</p>
      </section>

      {/* How it works */}
      <section className="px-4 py-12 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Camera, step: '1', title: 'Take a photo', desc: 'Stand side-on and take a full-body photo or use your webcam' },
              { icon: Zap, step: '2', title: 'AI analysis', desc: 'Our on-device AI detects 33 body landmarks and computes posture metrics' },
              { icon: FileText, step: '3', title: 'Get your report', desc: 'Receive a detailed scored report with your posture type and zone breakdown' }
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                  <Icon size={20} className="text-emerald-600" />
                </div>
                <div className="text-xs font-medium text-emerald-600 mb-1">Step {step}</div>
                <div className="font-semibold text-gray-900 mb-1">{title}</div>
                <div className="text-sm text-gray-500">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-12 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">What we analyse</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Head & neck alignment', detail: 'Forward head posture angle' },
            { label: 'Shoulder balance', detail: 'Left-right height symmetry' },
            { label: 'Spine & pelvis', detail: 'Pelvic tilt and spinal curve' },
            { label: 'Knee alignment', detail: 'Flexion and valgus check' },
            { label: 'Posture type', detail: '8 classified posture patterns' },
            { label: 'Overall score', detail: 'Weighted 0–100 rating' },
          ].map(({ label, detail }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
              <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{label}</div>
                <div className="text-xs text-gray-400">{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="px-4 py-8 bg-emerald-50">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { icon: Shield, label: 'Private by design', sub: 'Photos never leave your device' },
            { icon: Zap, label: 'On-device AI', sub: 'No server, no delay' },
            { icon: Users, label: 'Clinic-grade', sub: 'Trusted by Phrapy Physiotherapy' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label}>
              <Icon size={24} className="text-emerald-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-gray-900">{label}</div>
              <div className="text-xs text-gray-500">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to check your posture?</h2>
        <p className="text-gray-500 mb-6">Free, instant, private. No account needed.</p>
        <button
          onClick={() => navigate('/capture')}
          className="bg-emerald-500 text-white text-lg font-medium px-8 py-4 rounded-xl hover:bg-emerald-600 transition-all active:scale-95"
        >
          Start free scan
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-4 py-6 text-center text-xs text-gray-400">
        <p>PostureCheck · Powered by MediaPipe AI · Built for Phrapy Physiotherapy Center, Wakad, Pune</p>
        <p className="mt-1">This tool is for informational purposes only and does not constitute medical advice.</p>
      </footer>
    </div>
  )
}
