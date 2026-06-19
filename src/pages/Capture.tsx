import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Upload, RotateCcw, ChevronRight, AlertCircle, X } from 'lucide-react'
import { loadModel } from '../analysis/postureEngine'

type Mode = 'choose' | 'camera' | 'preview'

export default function Capture() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<Mode>('choose')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // Preload model on mount
  useEffect(() => {
    loadModel().catch(() => {})
  }, [])

  const startCamera = async () => {
    setError(null)
    setMode('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setCameraReady(true)
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again, or upload a photo instead.')
      setMode('choose')
    }
  }

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedImage(dataUrl)
    setMode('preview')
    stopCamera()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string)
      setMode('preview')
    }
    reader.readAsDataURL(file)
  }

  const analyzePhoto = async () => {
    if (!capturedImage) return
    setModelLoading(true)
    setError(null)
    sessionStorage.setItem('capturedImage', capturedImage)
    navigate('/analyzing')
  }

  const reset = () => {
    stopCamera()
    setCapturedImage(null)
    setMode('choose')
    setError(null)
  }

  useEffect(() => () => stopCamera(), [stopCamera])

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
      {mode !== 'preview' && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3">
          <p className="text-emerald-800 text-sm font-medium">For best results:</p>
          <p className="text-emerald-700 text-xs mt-0.5">Stand side-on (left or right) · Full body visible · Good lighting · Wear fitted clothing · Stand 1.5–2m from camera</p>
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
              <p className="text-gray-500 text-sm mt-1">Use camera or upload an existing photo</p>
            </div>
            <button
              onClick={startCamera}
              className="w-full bg-emerald-500 text-white rounded-xl p-5 flex items-center gap-4 hover:bg-emerald-600 transition-colors active:scale-95"
            >
              <div className="w-12 h-12 bg-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0">
                <Camera size={24} className="text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Use camera</div>
                <div className="text-emerald-100 text-sm">Take photo now with your device</div>
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
          </div>
        )}

        {/* Camera view */}
        {mode === 'camera' && (
          <div className="w-full max-w-sm">
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-[3/4]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {/* Silhouette guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 120 200" className="h-4/5 opacity-30" fill="none">
                  <ellipse cx="60" cy="20" rx="12" ry="14" stroke="white" strokeWidth="1.5"/>
                  <line x1="60" y1="34" x2="60" y2="100" stroke="white" strokeWidth="1.5"/>
                  <line x1="30" y1="55" x2="90" y2="55" stroke="white" strokeWidth="1.5"/>
                  <line x1="60" y1="100" x2="45" y2="150" stroke="white" strokeWidth="1.5"/>
                  <line x1="60" y1="100" x2="75" y2="150" stroke="white" strokeWidth="1.5"/>
                  <line x1="45" y1="150" x2="42" y2="195" stroke="white" strokeWidth="1.5"/>
                  <line x1="75" y1="150" x2="78" y2="195" stroke="white" strokeWidth="1.5"/>
                </svg>
                <div className="absolute inset-0 border-2 border-white/20 m-4 rounded-xl" />
              </div>
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-white text-sm">Starting camera...</div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-3 mt-4">
              <button onClick={reset} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="flex-1 bg-emerald-500 text-white rounded-xl py-3 font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Camera size={18} /> Capture
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {mode === 'preview' && capturedImage && (
          <div className="w-full max-w-sm">
            <div className="rounded-2xl overflow-hidden border border-gray-200 aspect-[3/4] bg-black">
              <img src={capturedImage} alt="Captured posture" className="w-full h-full object-contain" />
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mt-3 flex gap-2">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs">Make sure your full body (head to feet) is visible in the photo</p>
            </div>
            <div className="flex gap-3 mt-3">
              <button onClick={reset} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 rounded-xl py-3 px-4 font-medium hover:bg-gray-50">
                <RotateCcw size={16} /> Retake
              </button>
              <button
                onClick={analyzePhoto}
                disabled={modelLoading}
                className="flex-1 bg-emerald-500 text-white rounded-xl py-3 font-medium hover:bg-emerald-600 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {modelLoading ? 'Loading...' : <>Analyse posture <ChevronRight size={18} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
