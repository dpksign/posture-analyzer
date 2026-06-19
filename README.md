# PostureCheck — AI Posture Analysis

Free, on-device AI posture analysis web app. Scan your posture using your phone or webcam and get an instant scored report.

## Features (Phase 1)
- Side-view posture photo capture (webcam or upload)
- On-device AI analysis via MediaPipe Pose (no data upload)
- 5 posture metrics: head forward angle, shoulder tilt, pelvic tilt, spinal deviation, knee angle
- Overall score 0–100 with grade (Excellent / Good / Fair / Poor)
- 8 posture type classifications
- Zone breakdown with plain-language explanations
- Annotated photo with landmark overlay
- PDF report export
- WhatsApp share

## Tech Stack
- React 18 + TypeScript + Vite
- MediaPipe Tasks Vision (on-device WASM)
- Tailwind CSS
- jsPDF + html2canvas
- React Router v6
- Deployed on Vercel

## Getting Started

```bash
npm install
npm run dev
```

## Deploy to Vercel
Push to GitHub and connect the repo to Vercel. The `vercel.json` includes required COOP/COEP headers for MediaPipe WASM on Safari.

## Project Structure
```
src/
  analysis/       # MediaPipe engine + scoring logic
  pages/          # Landing, Capture, Analyzing, Report
  utils/          # PDF generation
  components/     # Shared UI components
```

## Built by
Deepak Singh — for Phrapy Physiotherapy Center, Wakad, Pune.
