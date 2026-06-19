import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'

export interface PostureMetrics {
  headForwardAngle: number
  shoulderTilt: number
  pelvicTilt: number
  spinalDeviation: number
  kneeAngle: number
}

export interface ZoneResult {
  name: string
  score: number
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  issue: string
  detail: string
}

export interface PostureReport {
  overallScore: number
  overallGrade: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  postureType: string
  postureTypeDescription: string
  zones: ZoneResult[]
  summary: string
  metrics: PostureMetrics
  annotatedImageUrl: string
}

let poseLandmarker: PoseLandmarker | null = null

export async function loadModel(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  )
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU'
    },
    runningMode: 'IMAGE',
    numPoses: 1
  })
}

function toRad(deg: number) { return deg * Math.PI / 180 }
function toDeg(rad: number) { return rad * 180 / Math.PI }

function angleBetween(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): number {
  const ab = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
  const bc = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2)
  const ac = Math.sqrt((cx - ax) ** 2 + (cy - ay) ** 2)
  const cosA = (ab ** 2 + bc ** 2 - ac ** 2) / (2 * ab * bc)
  return toDeg(Math.acos(Math.max(-1, Math.min(1, cosA))))
}

function verticalAngle(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return toDeg(Math.abs(Math.atan2(dx, Math.abs(dy))))
}

function scoreFromAngle(angle: number, ideal: number, maxDeviation: number): number {
  const deviation = Math.abs(angle - ideal)
  const score = Math.max(0, 100 - (deviation / maxDeviation) * 100)
  return Math.round(score)
}

function gradeFromScore(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Poor'
}

function classifyPostureType(metrics: PostureMetrics): { type: string; description: string } {
  const { headForwardAngle, pelvicTilt, spinalDeviation } = metrics

  if (headForwardAngle < 5 && pelvicTilt < 5 && spinalDeviation < 3) {
    return { type: 'Normal', description: 'Your posture is well-aligned. Keep maintaining your current habits.' }
  }
  if (headForwardAngle > 15 && pelvicTilt > 10) {
    return { type: 'Kyphosis-Lordosis', description: 'Upper back is rounded with an exaggerated lower back curve. Common from prolonged sitting.' }
  }
  if (headForwardAngle > 15) {
    return { type: 'Forward Head Posture', description: 'Your head is positioned forward of your shoulders. Often caused by screen use and poor ergonomics.' }
  }
  if (pelvicTilt > 12) {
    return { type: 'Lordosis', description: 'Excessive inward curve of the lower back. Can cause lower back strain and hip tightness.' }
  }
  if (pelvicTilt < -5) {
    return { type: 'Flat Back', description: 'The natural curve of your lower back is reduced. Can lead to hamstring tightness and poor shock absorption.' }
  }
  if (spinalDeviation > 6) {
    return { type: 'Lateral Imbalance', description: 'Your spine shows a sideways deviation. May indicate muscle imbalance between left and right sides.' }
  }
  if (headForwardAngle > 8 && pelvicTilt > 6) {
    return { type: 'Kyphosis', description: 'Rounded upper back causing the shoulders to roll forward. Commonly seen with desk-based work.' }
  }
  return { type: 'Mild Imbalance', description: 'Minor postural deviations detected. Small corrections can significantly improve your alignment.' }
}

function buildSummary(zones: ZoneResult[], postureType: string): string {
  const poorZones = zones.filter(z => z.grade === 'Poor' || z.grade === 'Fair')
  if (poorZones.length === 0) {
    return `Great posture! Your body alignment is excellent across all assessed zones. Continue your current habits and consider periodic re-checks every month.`
  }
  const issues = poorZones.map(z => z.issue.toLowerCase()).join(', ')
  return `Your posture analysis shows ${postureType.toLowerCase()} pattern with attention needed in: ${issues}. Targeted exercises and ergonomic adjustments can make a significant difference. Consider consulting a physiotherapist for a personalised treatment plan.`
}

export async function analyzePosture(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<PostureReport> {
  if (!poseLandmarker) throw new Error('Model not loaded')

  const results = poseLandmarker.detect(imageElement)

  if (!results.landmarks || results.landmarks.length === 0) {
    throw new Error('No person detected. Please ensure your full body is visible in the frame.')
  }

  const lm = results.landmarks[0]

  // Key landmark indices (MediaPipe Pose)
  // 0=nose, 2=left_eye, 5=right_eye, 7=left_ear, 8=right_ear
  // 11=left_shoulder, 12=right_shoulder, 23=left_hip, 24=right_hip
  // 25=left_knee, 26=right_knee, 27=left_ankle, 28=right_ankle

  const nose = lm[0]
  const leftEar = lm[7]
  const rightEar = lm[8]
  const leftShoulder = lm[11]
  const rightShoulder = lm[12]
  const leftHip = lm[23]
  const rightHip = lm[24]
  const leftKnee = lm[25]
  const rightKnee = lm[26]
  const leftAnkle = lm[27]
  const rightAnkle = lm[28]

  // Use side with better visibility (higher confidence)
  const usedLeft = leftShoulder.visibility! > rightShoulder.visibility!

  const ear = usedLeft ? leftEar : rightEar
  const shoulder = usedLeft ? leftShoulder : rightShoulder
  const hip = usedLeft ? leftHip : rightHip
  const knee = usedLeft ? leftKnee : rightKnee
  const ankle = usedLeft ? leftAnkle : rightAnkle

  // Head forward posture: angle of ear relative to shoulder vertical
  const headForwardAngle = verticalAngle(shoulder.x, shoulder.y, ear.x, ear.y)

  // Shoulder tilt: height difference between shoulders (normalised)
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) * 100

  // Pelvic tilt: angle of hip relative to shoulder-ankle line
  const pelvicTilt = verticalAngle(hip.x, hip.y, shoulder.x, shoulder.y) -
    verticalAngle(ankle.x, ankle.y, hip.x, hip.y)

  // Spinal deviation: lateral deviation of hip from shoulder-ankle midline
  const midX = (shoulder.x + ankle.x) / 2
  const spinalDeviation = Math.abs(hip.x - midX) * 100

  // Knee angle: angle at knee joint
  const kneeAngle = angleBetween(hip.x, hip.y, knee.x, knee.y, ankle.x, ankle.y)

  const metrics: PostureMetrics = {
    headForwardAngle: Math.round(headForwardAngle * 10) / 10,
    shoulderTilt: Math.round(shoulderTilt * 10) / 10,
    pelvicTilt: Math.round(Math.abs(pelvicTilt) * 10) / 10,
    spinalDeviation: Math.round(spinalDeviation * 10) / 10,
    kneeAngle: Math.round(kneeAngle * 10) / 10
  }

  // Score each zone
  const headScore = scoreFromAngle(headForwardAngle, 0, 25)
  const shoulderScore = scoreFromAngle(shoulderTilt, 0, 8)
  const spineScore = scoreFromAngle(Math.abs(pelvicTilt), 0, 20)
  const kneeScore = scoreFromAngle(kneeAngle, 175, 20)

  const zones: ZoneResult[] = [
    {
      name: 'Head & Neck',
      score: headScore,
      grade: gradeFromScore(headScore),
      issue: headForwardAngle > 10 ? 'Forward head posture' : 'Head alignment',
      detail: headForwardAngle > 15
        ? `Your head is significantly forward (${metrics.headForwardAngle}° off vertical). This puts up to 27kg of extra load on your cervical spine.`
        : headForwardAngle > 8
        ? `Mild forward head posture detected (${metrics.headForwardAngle}°). Common from screen use — chin tucks and neck stretches will help.`
        : `Head alignment is good (${metrics.headForwardAngle}° from vertical).`
    },
    {
      name: 'Shoulders',
      score: shoulderScore,
      grade: gradeFromScore(shoulderScore),
      issue: shoulderTilt > 3 ? 'Shoulder imbalance' : 'Shoulder alignment',
      detail: shoulderTilt > 5
        ? `Noticeable shoulder height difference detected. This can indicate muscle imbalance or scoliosis — worth checking with a physio.`
        : shoulderTilt > 2
        ? `Mild shoulder asymmetry found. Often caused by carrying bags on one side or uneven desk setup.`
        : `Shoulders are well-balanced.`
    },
    {
      name: 'Spine & Pelvis',
      score: spineScore,
      grade: gradeFromScore(spineScore),
      issue: Math.abs(pelvicTilt) > 8 ? 'Pelvic tilt' : 'Spinal alignment',
      detail: Math.abs(pelvicTilt) > 12
        ? `Significant pelvic tilt detected. This can cause lower back pain and hip tightness over time.`
        : Math.abs(pelvicTilt) > 6
        ? `Mild pelvic tilt present. Core strengthening and hip flexor stretching are recommended.`
        : `Spinal alignment looks good.`
    },
    {
      name: 'Knees & Lower Body',
      score: kneeScore,
      grade: gradeFromScore(kneeScore),
      issue: kneeAngle < 165 ? 'Knee flexion' : 'Leg alignment',
      detail: kneeAngle < 160
        ? `Knees appear slightly bent in standing position. Ensure you are standing fully upright during assessment.`
        : kneeAngle < 170
        ? `Slight knee flexion detected. This can be habitual — focus on fully extending knees when standing.`
        : `Knee alignment is good.`
    }
  ]

  // Weighted overall score
  const overallScore = Math.round(
    headScore * 0.30 +
    shoulderScore * 0.20 +
    spineScore * 0.30 +
    kneeScore * 0.20
  )

  const { type: postureType, description: postureTypeDescription } = classifyPostureType(metrics)

  // Draw annotated image
  const canvas = document.createElement('canvas')
  const sourceEl = imageElement as HTMLCanvasElement | HTMLImageElement
  canvas.width = 'naturalWidth' in sourceEl ? sourceEl.naturalWidth : sourceEl.width
  canvas.height = 'naturalHeight' in sourceEl ? sourceEl.naturalHeight : sourceEl.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imageElement, 0, 0)

  const drawingUtils = new DrawingUtils(ctx)
  drawingUtils.drawLandmarks(lm, {
    radius: 4,
    color: '#10b981',
    fillColor: '#10b981'
  })
  drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
    color: '#10b981',
    lineWidth: 2
  })

  // Highlight problem zones
  zones.forEach(zone => {
    if (zone.grade === 'Poor' || zone.grade === 'Fair') {
      ctx.strokeStyle = zone.grade === 'Poor' ? '#ef4444' : '#f59e0b'
      ctx.lineWidth = 3
    }
  })

  const annotatedImageUrl = canvas.toDataURL('image/jpeg', 0.9)

  return {
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    postureType,
    postureTypeDescription,
    zones,
    summary: buildSummary(zones, postureType),
    metrics,
    annotatedImageUrl
  }
}
