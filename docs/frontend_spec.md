# AI-Based Voice-Enabled Skill Gap Analyzer — Frontend Specification

---

## Project Overview

**Project:** AI-Based Voice-Enabled Skill Gap Analyzer
**Frontend Stack:** React 18 + Vite 6 + Tailwind CSS 3 + Chart.js 4 + Framer Motion
**Language:** JavaScript (JSX) — no TypeScript
**Chart Library:** Chart.js via `react-chartjs-2` (Line, Bar, Radar charts)
**Additional Libs:** `lucide-react` (icons), `three` (WebGL backdrop), `framer-motion` (animations)
**Theme/Style:** Modern/premium, dark + light mode (via `ThemeContext`), glassmorphism, motion-rich
**Target Users:** Normal users only (students/job seekers) — no admin panel
**Backend:** FastAPI (Python) — currently has a single `POST /analyze` endpoint

---

## 1. Product Flow (User Journey)

```
Landing Page (/)
    │
    ├── Start Interview → Interview Setup (/setup)
    │                          │
    │                          └── Start Interview → Live Interview (/interview) [immersive/dark]
    │                                                    │
    │                                                    └── Stop → AI Processing (/processing) [immersive/dark]
    │                                                                  │
    │                                                                  └── Done → Practice Summary (/summary) [immersive/dark]
    │                                                                                 │
    │                                                                                 └── View Full Results → Performance Analysis (/results)
    │
    ├── Dashboard (/dashboard) — main user home
    │       ├── Start Practice → /setup
    │       ├── Explore Learning → /resources
    │       ├── View Results → /analytics
    │       └── View All (sessions) → /history
    │
    ├── Interview History (/history)
    │       └── Click session → Session Review (/history/:id)
    │
    ├── Analytics & Insights (/analytics)
    │
    ├── Learning Resources (/resources)
    │
    └── Settings (/settings)
```

---

## 2. Core Pages (with Features)

### Page 1: Landing Page (`/`)
| Aspect | Details |
|---|---|
| **Purpose** | Product showcase, first impression, entry point to the app |
| **User Sees** | Animated hero (LandingHero + LandingBackdrop WebGL), setup preview card, feature highlights (Voice Analysis, Body Language, Technical Depth) |
| **User Can Do** | Navigate to `/setup`, `/resources`, `/history` |
| **Data** | Static content (no API call) |
| **Buttons/Actions** | `▶ Start Interview`, `📖 Explore Resources`, `📋 Past Reviews` |
| **Components** | `LandingHero`, `LandingBackdrop`, `LiquidEther` (WebGL), `SplitText` |

---

### Page 2: Dashboard (`/dashboard`)
| Aspect | Details |
|---|---|
| **Purpose** | User's main control center after login |
| **User Sees** | Welcome message, 3 feature cards (Practice, Learning, Analytics), recent sessions list, upgrade placeholder |
| **User Can Do** | Start a practice interview, explore learning, view analytics, browse session history |
| **Data** | `recentSessions` (title, date, duration, score), `analytics` summary |
| **Buttons/Actions** | `Start Practice →`, `Explore 🔍`, `View Results 📈`, `View All` (history), `View Pricing` |
| **API Needed** | `GET /api/dashboard` → `{ recentSessions, analytics }` |
| **Components** | Cards (inline), session list rows |

---

### Page 3: Interview Setup (`/setup`)
| Aspect | Details |
|---|---|
| **Purpose** | Configure practice session before starting |
| **User Sees** | Role dropdown, experience level pills, interview type pills, question count dropdown, difficulty pills, JD upload area |
| **User Can Do** | Select role, experience, type, difficulty, question count; upload job description (PDF/DOC/TXT); start interview |
| **Data** | Static config options (roles × 9, experience × 4, types × 4, difficulties × 3, question counts × 4) |
| **Buttons/Actions** | `🎯 Start Interview` |
| **API Needed** | `POST /api/sessions` → `{ sessionId }` (with setup payload: `{ role, experience, type, difficulty, questionCount, jobDescription }`) |
| **Components** | Pill selectors, dropdown, file upload zone |

---

### Page 4: Live Interview (`/interview`) — **Immersive/Dark Layout**
| Aspect | Details |
|---|---|
| **Purpose** | Core interview experience — emotionally the most important screen |
| **User Sees** | Current question (`QuestionCard`), AI status indicator (Listening/Ready), live transcript panel, recording waveform visual, record/pause/stop controls, question progress (Q1/5 etc.) |
| **User Can Do** | Record audio answer, pause recording, stop recording, see live transcript |
| **Data** | `questions` array from API (`{ id, content, category }`) |
| **Buttons/Actions** | Record (🔴), Pause (⏸), Stop (⏹) |
| **API Needed** | `GET /api/sessions/:id/questions`, `POST /api/sessions/:id/audio` (multipart audio blob) |
| **Components** | `QuestionCard`, `TranscriptPanel`, `RecordingControls` |

> **Interview Behavior:**
> - **Audio only** (no video capture)
> - **No visible timer** currently
> - **One question per page** (single question displayed at a time)
> - **Manual next question** (user controls flow via record → stop)
> - **Live transcript** visible during recording (placeholder — will come from ASR)
> - **No retake mid-session** — user answers once per question, can retry individual questions from Results page

---

### Page 5: AI Processing (`/processing`) — **Immersive/Dark Layout**
| Aspect | Details |
|---|---|
| **Purpose** | Loading/transition screen while AI analyzes responses |
| **User Sees** | Animated processing stages with progress indicators |
| **User Can Do** | Wait (auto-navigates to summary when done) |
| **Data** | `processingStages` from API or polling |
| **API Needed** | `GET /api/sessions/:id/processing-status` or WebSocket |
| **Components** | `ProgressChecklist` |

---

### Page 6: Practice Summary (`/summary`) — **Immersive/Dark Layout**
| Aspect | Details |
|---|---|
| **Purpose** | Per-question quick summary before full analysis |
| **User Sees** | Question recap, transcript of answer, quick score/feedback |
| **User Can Do** | View transcript, navigate to full results |
| **Data** | `practiceSummary` (`{ transcript, score, feedback }`) |
| **API Needed** | `GET /api/sessions/:id/questions/:qid/summary` |
| **Components** | Inline summary layout |

---

### Page 7: Performance Analysis (`/results`)
| Aspect | Details |
|---|---|
| **Purpose** | Full session-level analytics — the product's "proof of intelligence" |
| **User Sees** | Overall score hero (X/10 with rating label), radar chart (multi-axis competency), 5 score cards (Communication, Confidence, Technical Knowledge, Clarity, Fluency), AI suggestions panel, question-by-question breakdown with per-question score + status chip + topic tag |
| **User Can Do** | Retry individual questions, practice again, save & view history |
| **Data** | `performanceAnalysis` (`{ overallScore, ratingLabel, radarData, dimensions, aiSuggestions, questionBreakdown }`) |
| **Buttons/Actions** | `🔄 Practice Again`, `💾 Save & View History`, per-question `Retry` |
| **API Needed** | `GET /api/sessions/:id/analysis` |
| **Components** | `RadarChart`, `ScoreCard`, `FeedbackPanel`, `StatusChip` |

---

### Page 8: Interview History (`/history`)
| Aspect | Details |
|---|---|
| **Purpose** | Browse all past interview sessions |
| **User Sees** | List of session cards (title, date, duration, score, question count) |
| **User Can Do** | Click a session to view full review |
| **Data** | `interviewHistory` array of past sessions |
| **API Needed** | `GET /api/sessions?page=1&limit=10` |
| **Components** | `HistoryCard` |

---

### Page 9: Session Review (`/history/:id`)
| Aspect | Details |
|---|---|
| **Purpose** | Detailed review of a specific past session |
| **User Sees** | Session metadata, per-question breakdown, scores, transcripts, AI feedback |
| **User Can Do** | Review past answers, navigate back to history |
| **Data** | `sessionReview` (full session data with questions, answers, scores) |
| **API Needed** | `GET /api/sessions/:id/review` |
| **Components** | `ScoreCard`, `StatusChip`, inline review sections |

---

### Page 10: Analytics & Insights (`/analytics`)
| Aspect | Details |
|---|---|
| **Purpose** | Long-term performance tracking and trend analysis |
| **User Sees** | Summary stats (Total Sessions, Avg Score, Most Improved area, Focus Area), score trend line chart over time, weak area frequency bar chart, competency averages per dimension |
| **User Can Do** | View trends, identify weak areas |
| **Data** | `analytics` (`{ totalSessions, averageScore, mostImproved, focusArea, scoreTrend, weakAreas, competencyAverages }`) |
| **API Needed** | `GET /api/analytics` |
| **Components** | `ScoreCard`, Chart.js `Line` chart, Chart.js `Bar` chart |

---

### Page 11: Learning Resources (`/resources`)
| Aspect | Details |
|---|---|
| **Purpose** | Curated interview preparation materials |
| **User Sees** | Resource cards with titles and descriptions |
| **User Can Do** | Browse and explore resources |
| **Data** | `resources` array |
| **API Needed** | `GET /api/resources` |
| **Components** | `ResourceCard` |

---

### Page 12: Settings (`/settings`)
| Aspect | Details |
|---|---|
| **Purpose** | User profile and preferences management |
| **User Sees** | Profile section (name, email), default role dropdown, theme toggle (light/dark/system), notification toggles (Session Reminders, Weekly Progress, New Resources), privacy section |
| **User Can Do** | Edit name/email, change default role, toggle theme, manage notifications, request data deletion |
| **Data** | User profile and preferences (currently hardcoded placeholders) |
| **Buttons/Actions** | `Save Settings`, `Request Data Deletion` |
| **API Needed** | `GET /api/settings`, `POST /api/settings` |
| **Components** | Form inputs, pill toggles, switch toggles |

---

## 3. UI Preferences

| Aspect | Choice |
|---|---|
| **Style** | Modern/fancy, premium product feel — NOT a student-project aesthetic |
| **Theme** | Dual-mode: light (default app shell) + dark (immersive interview screens) |
| **Theme Toggle** | User-controlled via Settings (light / dark / system) |
| **Design Language** | Glassmorphism panels, rounded corners (2xl), gradient backgrounds, soft shadows |
| **Animations** | Framer Motion for page transitions, hover-lift effects, animated hero (WebGL/Three.js backdrop) |
| **Typography** | Clean system fonts, bold headings, uppercase tracking-wider section headers |
| **Color Palette** | Primary: orange (`#f97316` family), ink grays for text, surface neutrals for backgrounds |

---

## 4. Tech Stack (Confirmed)

| Layer | Technology |
|---|---|
| **Framework** | React 18.3.1 |
| **Build Tool** | Vite 6.0.1 |
| **Routing** | React Router DOM 6.28 |
| **Styling** | Tailwind CSS 3.4.15 |
| **Charts** | Chart.js 4.4.7 + react-chartjs-2 5.2.0 (Line, Bar, Radar) |
| **Animations** | Framer Motion 12.36 |
| **Icons** | Lucide React 0.577 |
| **3D/WebGL** | Three.js 0.183.2 (landing page backdrop) |
| **Language** | JavaScript (no TypeScript) |
| **State Management** | React Context (`ThemeContext`) + local `useState` per page |

---

## 5. Backend Integration Details

### Current Backend State
- **Framework:** FastAPI (Python)
- **Existing Endpoint:** `POST /analyze` (placeholder — accepts audio_data dict, runs pipeline orchestrator)
- **Pipeline:** `PipelineOrchestrator` in `backend/services/orchestrator.py`

### Expected Frontend API Contract (from mockApi.js)

| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/api/sessions` | POST | `{ role, experience, type, difficulty, questionCount, jobDescription }` | `{ sessionId }` |
| `/api/sessions/:id/questions` | GET | — | `[{ id, content, category }]` |
| `/api/sessions/:id/audio` | POST | Multipart (audioBlob) | `{ success: boolean }` |
| `/api/sessions/:id/questions/:qid/transcript` | GET | — | `{ transcript }` |
| `/api/sessions/:id/questions/:qid/summary` | GET | — | `{ transcript, score, feedback }` |
| `/api/sessions/:id/analysis` | GET | — | `{ overallScore, ratingLabel, radarData, dimensions, aiSuggestions, questionBreakdown }` |
| `/api/sessions` | GET | `?page=1&limit=10` | `[{ id, title, date, duration, score, questionCount }]` |
| `/api/sessions/:id/review` | GET | — | `{ session metadata + per-question data }` |
| `/api/dashboard` | GET | — | `{ recentSessions, analytics }` |
| `/api/analytics` | GET | — | `{ totalSessions, averageScore, mostImproved, focusArea, scoreTrend, weakAreas, competencyAverages }` |
| `/api/resources` | GET | — | `[{ id, title, description, ... }]` |
| `/api/sessions/:id/processing-status` | GET/WS | — | `[{ stage, status, label }]` |
| `/api/settings` | GET/POST | Profile + preferences payload | `{ name, email, role, theme, notifications }` |

### Auth Flow
> **⚠️ No auth system exists yet.** No login/signup pages are built. Currently all pages are freely accessible. Auth will need to be added (JWT-based with the FastAPI backend is the likely path).

---

## 6. User Roles

| Role | Supported |
|---|---|
| **Normal User** | ✅ Only role — students/job seekers practicing interviews |
| **Admin** | ❌ Not planned for MVP |

---

## 7. Interview Behavior

| Aspect | Current Implementation |
|---|---|
| **Media** | Audio only (no video capture) |
| **Timer** | Not implemented |
| **Question Display** | One question per page |
| **Navigation** | Manual — user controls record/pause/stop, then auto-navigates to processing |
| **Live Transcript** | Visible during recording (placeholder mock — will connect to ASR) |
| **Retake** | Not mid-session; can retry individual questions from Results page |
| **Recording Controls** | Record 🔴, Pause ⏸, Stop ⏹ (via `RecordingControls` component) |
| **Processing** | After stop → navigates to `/processing` → then `/summary` → then `/results` |

---

## 8. Report / Dashboard / Analytics Expectations

### Performance Analysis Report (`/results`)
- ✅ Overall score (X / 10 with label: e.g., "Good")
- ✅ Per-question score with topic tags and status chips (Strong / Needs Work)
- ✅ Radar chart (5 axes: Communication, Confidence, Technical Knowledge, Clarity, Fluency)
- ✅ Individual dimension score cards
- ✅ AI suggestions / recommendations panel
- ✅ Question-by-question breakdown with retry option

### Analytics Dashboard (`/analytics`)
- ✅ Historical trend (line chart, score over months)
- ✅ Weak area frequency (horizontal bar chart)
- ✅ Competency averages per dimension
- ✅ Summary stats: total sessions, average score, most improved, focus area

### Main Dashboard (`/dashboard`)
- ✅ Recent sessions with scores
- ✅ Quick-action feature cards
- ❌ No strengths/weaknesses summary on dashboard (lives on Analytics page)

---

## 9. Required vs Optional Pages

### ✅ Must-Have (MVP) — All Built
| # | Page | Route | Status |
|---|---|---|---|
| 1 | Landing Page | `/` | ✅ Built |
| 2 | Dashboard | `/dashboard` | ✅ Built |
| 3 | Interview Setup | `/setup` | ✅ Built |
| 4 | Live Interview | `/interview` | ✅ Built (mock) |
| 5 | AI Processing | `/processing` | ✅ Built (mock) |
| 6 | Practice Summary | `/summary` | ✅ Built (mock) |
| 7 | Performance Analysis | `/results` | ✅ Built (mock) |
| 8 | Interview History | `/history` | ✅ Built (mock) |
| 9 | Session Review | `/history/:id` | ✅ Built (mock) |
| 10 | Settings | `/settings` | ✅ Built (placeholder) |

### 🔜 Good to Have Later
| # | Feature/Page | Notes |
|---|---|---|
| 1 | Login / Signup | No auth pages exist — needed for real deployment |
| 2 | Profile Page | Currently embedded in Settings — could be separated |
| 3 | Analytics (enhanced) | `/analytics` is built MVP — can add more charts/filters |
| 4 | Learning Resources (enhanced) | `/resources` is minimal — can add categories, bookmarks |
| 5 | Admin Dashboard | Not planned |
| 6 | Video Analysis | Landing page mentions it, but not implemented |
| 7 | Notification System | Settings has toggles but no real notification infrastructure |

---

## 10. Constraints

| Constraint | Details |
|---|---|
| **Project Type** | Final year (8th semester) academic project |
| **Time** | Limited — MVP must be functional for demo |
| **Responsive** | Desktop-first design, but Tailwind responsive classes are used (`md:`, `lg:`) |
| **Mobile** | Basic responsive support via Tailwind grid breakpoints |
| **Paid Libraries** | None — all libraries are free/open-source |
| **Deployment** | Vercel (frontend) — inferred from previous build error conversations |

---

## Existing Folder Structure

```
frontend/web/src/
├── App.jsx                    # Root component & route definitions
├── main.jsx                   # React entry point
├── index.css                  # Global styles & Tailwind config
├── components/
│   ├── EmptyState.jsx         # "No data" placeholder
│   ├── ErrorState.jsx         # Error display
│   ├── FeedbackPanel.jsx      # AI suggestions panel
│   ├── Footer.jsx             # App footer
│   ├── GlassPanel.jsx         # Glassmorphism container
│   ├── Header.jsx             # App header + navigation
│   ├── HistoryCard.jsx        # Session history card
│   ├── LandingBackdrop.jsx    # WebGL backdrop wrapper
│   ├── LandingHero.jsx        # Animated hero section
│   ├── LiquidEther.jsx        # Three.js WebGL effect
│   ├── LoadingState.jsx       # Loading spinner
│   ├── ProgressChecklist.jsx  # Processing stages checklist
│   ├── QuestionCard.jsx       # Interview question display
│   ├── RadarChart.jsx         # Radar/spider chart
│   ├── RecordingControls.jsx  # Record/Pause/Stop buttons
│   ├── ResourceCard.jsx       # Learning resource card
│   ├── ScoreCard.jsx          # Score display card
│   ├── SplitText.jsx          # Animated text splitter
│   ├── StatusChip.jsx         # Status badge (Strong/Weak)
│   └── TranscriptPanel.jsx    # Live transcript display
├── context/
│   └── ThemeContext.jsx       # Dark/light/system theme
├── data/
│   └── mockData.js            # All mock data
├── layouts/
│   ├── AppLayout.jsx          # Standard app shell (light)
│   └── ImmersiveLayout.jsx    # Dark immersive shell
├── services/
│   └── mockApi.js             # API abstraction (mock → real)
```

---

## Routing Map

| Route | Page | Layout |
|---|---|---|
| `/` | LandingPage | AppLayout |
| `/dashboard` | DashboardPage | AppLayout |
| `/setup` | InterviewSetupPage | AppLayout |
| `/interview` | LiveInterviewPage | ImmersiveLayout |
| `/processing` | AIProcessingPage | ImmersiveLayout |
| `/summary` | PracticeSummaryPage | ImmersiveLayout |
| `/results` | PerformanceAnalysisPage | AppLayout |
| `/history` | InterviewHistoryPage | AppLayout |
| `/history/:id` | SessionReviewPage | AppLayout |
| `/analytics` | AnalyticsPage | AppLayout |
| `/resources` | LearningResourcesPage | AppLayout |
| `/settings` | SettingsPage | AppLayout |
