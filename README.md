# 💃 DanceCoach AI

**See yourself dance better — in real time.**

DanceCoach AI is a browser-based dance learning platform that uses MediaPipe BlazePose to compare your movements against a reference dance video in real-time, giving you body-part-level visual feedback.

![DanceCoach AI](https://img.shields.io/badge/DanceCoach-AI-blueviolet?style=for-the-badge) ![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react) ![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite) ![MediaPipe](https://img.shields.io/badge/MediaPipe-BlazePose-00897B?style=for-the-badge)

## ✨ Features

- **🎯 Body-Part Scoring** — Per-segment accuracy for arms, legs, torso, and head
- **⚡ Real-Time Comparison** — Live side-by-side at 20+ FPS with color-coded skeleton overlay
- **🔒 Privacy First** — All AI runs in your browser. Video never leaves your device
- **📊 Session Analytics** — Accuracy-over-time charts, body-part ranking, improvement tips
- **🪞 Mirror Mode** — Toggle webcam mirroring for natural practice
- **🐌 Speed Control** — Slow down reference video (0.5×, 0.75×, 1×)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:5174
```

## 🎮 How to Use

1. **Upload** any dance video (MP4, MOV, WebM) or drag & drop
2. **Click** "Start Dancing" — your webcam + reference play side-by-side
3. **Dance** along — your skeleton lights up green (matching) or red (off)
4. **Stop** to see your session summary with charts and tips

## 🧠 How It Works

```
Reference Video → MediaPipe BlazePose → 33 Keypoints → Normalize
                                                         ↓
User Webcam    → MediaPipe BlazePose → 33 Keypoints → Normalize → Cosine Similarity → Score
```

1. **Pose Normalization** — Body-center coordinates with torso-length scaling (size-invariant)
2. **Cosine Similarity** — Compares limb direction vectors per body segment
3. **Weighted Scoring** — Arms/legs weighted 1.5×, torso 1×, head 0.5×
4. **Confidence Filtering** — Only scores joints with visibility > 0.4

## 📁 Project Structure

```
src/
├── App.jsx                     # Main orchestrator
├── index.css                   # Design system
├── components/
│   ├── VideoPlayer.jsx         # Reference video + pose extraction
│   ├── WebcamFeed.jsx          # User webcam + scored skeleton
│   ├── ScoreDisplay.jsx        # Score ring + body-part breakdown
│   └── SessionSummary.jsx      # Post-session analytics
└── utils/
    ├── poseNormalizer.js        # Body-center normalization + mirror
    ├── poseSimilarity.js        # Cosine similarity scoring engine
    └── skeletonRenderer.js      # Color-coded skeleton drawing
```

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| **Vite + React 18** | Fast dev, HMR, modern tooling |
| **MediaPipe BlazePose** | 33-keypoint pose estimation (browser-native) |
| **Recharts** | Session analytics charts |
| **Vanilla CSS** | Premium dark design system |
| **Web Audio API** | Ready for rhythm scoring (v2) |

## 📊 Market Context

- Dance learning apps market: **$1.5B** (2023) → **$4.7B** (2032)
- No existing app offers real-time visual body-part comparison
- Privacy-first approach (no video uploads) differentiates from all competitors

## 📄 License

MIT
