import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Upload, RotateCcw, ChevronRight, AlertCircle, X, FlipHorizontal } from 'lucide-react'
import { loadModel } from '../analysis/postureEngine'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

type Mode = 'choose' | 'camera' | 'preview'
type FacingMode = 'environment' | 'user'
type DetectionStatus = 'waiting' | 'partial' | 'ready' | 'countdown' | 'captured'

interface DetectionFeedback {
  status: DetectionStatus
  message: string
  confidence: number  // 0-1, how complete the body detection is
}

// Key landmark indices we need visible for a good posture scan
const REQUIRED_LANDMARKS = [
  0,   // nose
  7,   // left ear
  8,   // right ear
  11,  // left shoulder
  12,  // right shoulder
  23,  // left hip
  24,  // right hip
  25,  // left knee
  26,  // right knee
  27,  // left ankle
  28,  // right ankle
]

const VISIBILITY_THRESHOLD = 0.5
const STABLE_FRAMES_NEEDED = 4   // ~2s at 500ms interval
const COUNTDOWN_FROM = 3

export default function Capture() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<PoseLandmarker | null>(null)
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stableFramesRef = useRef(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const capturedRef = useRef(false)

  const [mode, setMode] = useState<Mode>('choose')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [switching, setSwitching] = useState(false)
  const [feedback, setFeedback] = useState<DetectionFeedback>({
    status: 'waiting', message: 'Position yourself in frame', confidence: 0
  })
  const [countdown, setCountdown] = useState<number | null>(null)
  const [silhouetteReady, setSilhouetteReady] = useState(false)

  // Load both main model and lightweight detector
  useEffect(() => {
    const init = async () => {
      setModelLoading(true)
      try {
        await loadModel()
        // Also load a separate instance for live detection
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )
        detectorRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          numPoses: 1
        })
      } catch (_) {}
      setModelLoading(false)
    }
    init()

    navigator.mediaDevices.enumerateDevices().then(devices => {
      // just checking — no state needed, flip button always shown on mobile
    }).catch(() => {})

    return () => { stopDetection() }
  }, [])

  const stopDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    stableFramesRef.current = 0
    capturedRef.current = false
  }

  const stopCamera = useCallback(() => {
    stopDetection()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
    setSilhouetteReady(false)
  }, [])

  const checkBody = useCallback(() => {
    if (!videoRef.current || !detectorRef.current || capturedRef.current) return
    const video = videoRef.current
    if (video.readyState < 2) return

    try {
      const results = detectorRef.current.detect(video)

      if (!results.landmarks || results.landmarks.length === 0) {
        stableFramesRef.current = 0
        setFeedback({ status: 'waiting', message: 'No person detected — step into frame', confidence: 0 })
        setSilhouetteReady(false)
        return
      }

      const lm = results.landmarks[0]

      // Count how many required landmarks are visible
      const visibleCount = REQUIRED_LANDMARKS.filter(
        idx => (lm[idx]?.visibility ?? 0) > VISIBILITY_THRESHOLD
      ).length
      const confidence = visibleCount / REQUIRED_LANDMARKS.length

      // Check specific missing areas for targeted feedback
      const headVisible = (lm[0]?.visibility ?? 0) > VISIBILITY_THRESHOLD
      const feetVisible =
        (lm[27]?.visibility ?? 0) > VISIBILITY_THRESHOLD ||
        (lm[28]?.visibility ?? 0) > VISIBILITY_THRESHOLD
      const hipsVisible =
        (lm[23]?.visibility ?? 0) > VISIBILITY_THRESHOLD &&
        (lm[24]?.visibility ?? 0) > VISIBILITY_THRESHOLD

      if (!headVisible) {
        stableFramesRef.current = 0
        setSilhouetteReady(false)
        setFeedback({ status: 'partial', message: 'Move back — head not visible', confidence })
        return
      }
      if (!feetVisible) {
        stableFramesRef.current = 0
        setSilhouetteReady(false)
        setFeedback({ status: 'partial', message: 'Move back — full legs not visible', confidence })
        return
      }
      if (!hipsVisible) {
        stableFramesRef.current = 0
        setSilhouetteReady(false)
        setFeedback({ status: 'partial', message: 'Turn slightly — hips not visible', confidence })
        return
      }
      if (confidence < 0.8) {
        stableFramesRef.current = 0
        setSilhouetteReady(false)
        setFeedback({ status: 'partial', message: 'Almost there — ensure full body is visible', confidence })
        return
      }

      // Body fully detected
      stableFramesRef.current += 1
      setSilhouetteReady(true)

      if (stableFramesRef.current < STABLE_FRAMES_NEEDED) {
        const remaining = STABLE_FRAMES_NEEDED - stableFramesRef.current
        setFeedback({
          status: 'ready',
          message: `Hold still… (${remaining})`,
          confidence
        })
        return
      }

      // Start countdown if not already
      if (stableFramesRef.current === STABLE_FRAMES_NEEDED) {
        setFeedback({ status: 'countdown', message: 'Perfect! Capturing...', confidence })
        stopDetection()
        startCountdown()
      }
    } catch (_) {}
  }, [])

  const startCountdown = () => {
    let count = COUNTDOWN_FROM
    setCountdown(count)
    countdownRef.current = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(countdownRef.current!)
        countdownRef.current = null
        setCountdown(null)
        triggerCapture()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  const triggerCapture = useCallback(() => {
    if (capturedRef.current || !videoRef.current || !canvasRef.current) return
    capturedRef.current = true
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedImage(dataUrl)
    setMode('preview')
    stopCamera()
  }, [facingMode, stopCamera])

  const startDetectionLoop = useCallback(() => {
    stopDetection()
    stableFramesRef.current = 0
    capturedRef.current = false
    setFeedback({ status: 'waiting', message: 'Position yourself in frame', confidence: 0 })
    setSilhouetteReady(false)
    setCountdown(null)
    // Poll every 500ms
    detectionIntervalRef.current = setInterval(checkBody, 500)
  }, [checkBody])

  const startCamera = async (facing: FacingMode = facingMode) => {
    setError(null)
    setMode('camera')
    setCameraReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true)
          // Start detection loop after camera is ready
          setTimeout(startDetectionLoop, 800)
        }
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again, or upload a photo instead.')
      setMode('choose')
    }
  }

  const switchCamera = async () => {
    if (switching) return
    setSwitching(true)
    stopDetection()
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment'
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
    setSilhouetteReady(false)
    setFacingMode(next)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true)
          setTimeout(startDetectionLoop, 800)
        }
      }
    } catch {
      setError('Could not switch camera. Your device may only have one camera.')
      setFacingMode(facingMode)
      await startCamera(facingMode)
    } finally {
      setSwitching(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string)
      setMode('preview')
    }
    reader.readAsDataURL(file)
  }

  const analyzePhoto = () => {
    if (!capturedImage) return
    sessionStorage.setItem('capturedImage', capturedImage)
    navigate('/analyzing')
  }

  const reset = () => {
    stopCamera()
    setCapturedImage(null)
    setMode('choose')
    setError(null)
    setCountdown(null)
    setSilhouetteReady(false)
  }

  useEffect(() => () => stopCamera(), [stopCamera])

  // Feedback bar config
  const feedbackConfig = {
    waiting:   { bg: 'bg-black/50',        text: 'text-white',        icon: '👤' },
    partial:   { bg: 'bg-amber-500/90',    text: 'text-white',        icon: '⚠️' },
    ready:     { bg: 'bg-blue-500/90',     text: 'text-white',        icon: '✓' },
    countdown: { bg: 'bg-emerald-500/90',  text: 'text-white',        icon: '📸' },
    captured:  { bg: 'bg-emerald-500/90',  text: 'text-white',        icon: '✓' },
  }

  const fb = feedbackConfig[feedback.status]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => { stopCamera(); navigate('/') }} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center">
            <Camera size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-gray-900">Posture Scan</span>
        </div>
        <div className="ml-auto flex gap-1">
          {['Photo', 'Analyse', 'Report'].map((step, i) => (
            <div key={step} className="flex items-center gap-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium
                ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}
              </div>
              {i < 2 && <div className="w-3 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Instruction banner */}
      {mode === 'choose' && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3">
          <p className="text-emerald-800 text-sm font-medium">For best results:</p>
          <p className="text-emerald-700 text-xs mt-0.5">Stand side-on · Full body visible · Good lighting · Wear fitted clothing · Stand 1.5–2m from camera</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {/* Error */}
        {error && (
          <div className="w-full max-w-sm bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Choose mode */}
        {mode === 'choose' && (
          <div className="w-full max-w-sm space-y-3">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Take your posture photo</h2>
              <p className="text-gray-500 text-sm mt-1">Place your phone on a surface, step back — it captures automatically</p>
            </div>
            <button
              onClick={() => startCamera(facingMode)}
              disabled={modelLoading}
              className="w-full bg-emerald-500 text-white rounded-xl p-5 flex items-center gap-4 hover:bg-emerald-600 transition-colors active:scale-95 disabled:opacity-60"
            >
              <div className="w-12 h-12 bg-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <Camera size={24} className="text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold">{modelLoading ? 'Loading AI…' : 'Use camera'}</div>
                <div className="text-emerald-100 text-sm">Auto-captures when you're in position</div>
              </div>
              <ChevronRight size={18} className="text-emerald-300 ml-auto" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-white border border-gray-200 text-gray-700 rounded-xl p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors active:scale-95"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Upload size={24} className="text-gray-500" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Upload photo</div>
                <div className="text-gray-400 text-sm">Choose an existing side-view photo</div>
              </div>
              <ChevronRight size={18} className="text-gray-300 ml-auto" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            {/* How it works hint */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mt-2">
              <p className="text-blue-700 text-xs font-medium mb-1">How auto-capture works</p>
              <p className="text-blue-600 text-xs leading-relaxed">
                1. Prop your phone against a wall or use a stand<br/>
                2. Tap "Use camera" then step back 1.5–2m<br/>
                3. Stand side-on — AI detects your body automatically<br/>
                4. Hold still for 2 seconds → photo taken!
              </p>
            </div>
          </div>
        )}

        {/* Camera view */}
        {mode === 'camera' && (
          <div className="w-full max-w-sm">
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-[3/4]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
              />

              {/* Silhouette guide — dims/brightens based on detection */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 120 200" className="h-4/5 transition-opacity duration-500" fill="none"
                  style={{ opacity: silhouetteReady ? 0.9 : 0.25 }}>
                  <ellipse cx="60" cy="20" rx="12" ry="14"
                    stroke={silhouetteReady ? '#10b981' : 'white'} strokeWidth="1.5"/>
                  <line x1="60" y1="34" x2="60" y2="100"
                    stroke={silhouetteReady ? '#10b981' : 'white'} strokeWidth="1.5"/>
                  <line x1="30" y1="55" x2="90" y2="55"
                    stroke={silhouetteReady ? '#10b981' : 'white'} strokeWidth="1.5"/>
                  <line x1="60" y1="100" x2="45" y2="150"
                    stroke={silhouetteReady ? '#10b981' : 'white'} strokeWidth="1.5"/>
                  <line x1="60" y1="100" x2="75" y2="150"
                    stroke={silhouetteReady ? '#10b981' : 'white'} strokeWidth="1.5"/>
                  <line x1="45" y1="150" x2="42" y2="195"
                    stroke={silhouetteReady ? '#10b981' : 'white'} strokeWidth="1.5"/>
                  <line x1="75" y1="150" x2="78" y2="195"
                    stroke={silhouetteReady ? '#10b981' : 'white'} strokeWidth="1.5"/>
                </svg>
                {/* Border frame */}
                <div className={`absolute inset-0 border-2 m-4 rounded-xl transition-colors duration-500
                  ${silhouetteReady ? 'border-emerald-400/60' : 'border-white/20'}`} />
              </div>

              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-24 h-24 bg-emerald-500/80 rounded-full flex items-center justify-center">
                    <span className="text-white text-5xl font-bold">{countdown}</span>
                  </div>
                </div>
              )}

              {/* Confidence bar — top of viewfinder */}
              {cameraReady && feedback.status !== 'waiting' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.round(feedback.confidence * 100)}%`,
                      background: feedback.confidence >= 0.8 ? '#10b981' : feedback.confidence >= 0.5 ? '#f59e0b' : '#ef4444'
                    }}
                  />
                </div>
              )}

              {/* Feedback pill */}
              {cameraReady && (
                <div className={`absolute bottom-4 left-4 right-4 ${fb.bg} backdrop-blur-sm rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all duration-300`}>
                  <span className="text-base">{fb.icon}</span>
                  <span className={`text-sm font-medium ${fb.text} flex-1`}>{feedback.message}</span>
                  {feedback.status === 'ready' || feedback.status === 'countdown' ? (
                    <div className="flex gap-0.5">
                      {[...Array(STABLE_FRAMES_NEEDED)].map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < stableFramesRef.current ? 'bg-white' : 'bg-white/30'}`} />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Flip button */}
              <button
                onClick={switchCamera}
                disabled={switching}
                className="absolute top-3 right-3 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/60 active:scale-90 transition-all disabled:opacity-40"
                aria-label="Switch camera"
              >
                {switching
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <FlipHorizontal size={18} />
                }
              </button>

              {/* Camera label */}
              <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                {facingMode === 'environment' ? 'Back camera' : 'Front camera'}
              </div>

              {!cameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <div className="text-white text-sm">Starting camera…</div>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Front camera tip */}
            {facingMode === 'user' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 mt-2 flex gap-2">
                <AlertCircle size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-600 text-xs">Tip: Back camera gives more accurate results. Use front camera only if scanning alone.</p>
              </div>
            )}

            {/* Manual capture fallback */}
            <div className="flex gap-3 mt-3">
              <button onClick={reset} className="border border-gray-200 text-gray-600 rounded-xl py-3 px-5 font-medium hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button
                onClick={triggerCapture}
                disabled={!cameraReady}
                className="flex-1 border border-emerald-200 text-emerald-600 bg-emerald-50 rounded-xl py-3 font-medium hover:bg-emerald-100 disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
              >
                <Camera size={16} /> Capture manually
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">Auto-captures when full body is detected · or tap above</p>
          </div>
        )}

        {/* Preview */}
        {mode === 'preview' && capturedImage && (
          <div className="w-full max-w-sm">
            <div className="rounded-2xl overflow-hidden border border-gray-200 aspect-[3/4] bg-black">
              <img src={capturedImage} alt="Captured posture" className="w-full h-full object-contain" />
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mt-3 flex gap-2">
              <span className="text-emerald-500 text-base">✓</span>
              <p className="text-emerald-700 text-xs font-medium">Photo captured! Make sure your full body (head to feet) is visible before analysing.</p>
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={reset} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 rounded-xl py-3 px-4 font-medium hover:bg-gray-50 text-sm">
                <RotateCcw size={16} /> Retake
              </button>
              <button
                onClick={analyzePhoto}
                className="flex-1 bg-emerald-500 text-white rounded-xl py-3 font-medium hover:bg-emerald-600 flex items-center justify-center gap-2 text-sm"
              >
                Analyse posture <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
