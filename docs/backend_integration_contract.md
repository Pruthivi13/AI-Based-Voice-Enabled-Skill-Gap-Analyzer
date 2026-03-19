# Backend Integration Contract — Detailed Addendum

> This document covers the 5 areas needed before coding against the real backend:
> exact JSON contracts, auth, file uploads, processing-status behavior, and error/empty states.

---

## 1. Exact Request/Response JSON for Each Endpoint

### 1.1 `POST /api/auth/register`
```jsonc
// Request
{
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "password": "secureP@ss123"
}

// Response — 201 Created
{
  "user": {
    "id": "usr_abc123",
    "name": "Alex Johnson",
    "email": "alex@example.com",
    "createdAt": "2026-03-19T15:30:00Z"
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "dGhpcyBpcyBh..."
}
```

### 1.2 `POST /api/auth/login`
```jsonc
// Request
{
  "email": "alex@example.com",
  "password": "secureP@ss123"
}

// Response — 200 OK
{
  "user": {
    "id": "usr_abc123",
    "name": "Alex Johnson",
    "email": "alex@example.com"
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "dGhpcyBpcyBh..."
}

// Response — 401 Unauthorized
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect."
}
```

### 1.3 `POST /api/auth/refresh`
```jsonc
// Request
{ "refreshToken": "dGhpcyBpcyBh..." }

// Response — 200 OK
{ "accessToken": "eyJhbGciOi...(new)..." }

// Response — 401
{ "error": "TOKEN_EXPIRED", "message": "Refresh token has expired. Please login again." }
```

### 1.4 `POST /api/sessions` — Create Interview Session
```jsonc
// Request
{
  "role": "Frontend Developer",         // enum from setup page
  "experience": "Entry Level",          // enum
  "type": "Technical",                  // "Technical" | "Behavioral" | "Mixed" | "System Design"
  "difficulty": "Medium",               // "Easy" | "Medium" | "Hard"
  "questionCount": 5,                   // 3 | 5 | 7 | 10
  "jobDescriptionFileId": "file_xyz"    // nullable — from JD upload response
}

// Response — 201 Created
{
  "sessionId": "sess_1710856200000",
  "status": "created",
  "createdAt": "2026-03-19T15:30:00Z"
}
```

### 1.5 `GET /api/sessions/:sessionId/questions` — Fetch Questions
```jsonc
// Response — 200 OK
{
  "sessionId": "sess_1710856200000",
  "questions": [
    {
      "id": 1,
      "content": "Tell me about a project where you solved a difficult problem.",
      "category": "Behavioral",        // "Technical" | "Behavioral"
      "difficulty": "Medium",
      "topic": "Problem Solving",
      "referenceAnswer": "Describe the situation, your approach, the technologies used, and the outcome."
    }
    // ... more questions
  ]
}
```

### 1.6 `POST /api/sessions/:sessionId/questions/:questionId/audio` — Upload Audio
```jsonc
// Request — multipart/form-data
// Field: "audio" — Blob (WebM/opus or WAV, 16kHz mono)

// Response — 200 OK
{
  "success": true,
  "questionId": 1,
  "audioId": "aud_abc123",
  "durationMs": 42000
}

// Response — 413 Payload Too Large
{
  "error": "FILE_TOO_LARGE",
  "message": "Audio file exceeds the 25MB limit."
}
```

### 1.7 `GET /api/sessions/:sessionId/questions/:questionId/transcript`
```jsonc
// Response — 200 OK
{
  "questionId": 1,
  "transcript": "In my final year project I developed a web application..."
}
```

### 1.8 `GET /api/sessions/:sessionId/questions/:questionId/summary` — Practice Summary
```jsonc
// Response — 200 OK
{
  "questionId": 1,
  "transcript": "In my final year project I developed...",
  "quickScore": 7.8,                    // float 0–10
  "strengths": [
    "Clear problem description",
    "Good use of technical terminology",
    "Structured answer with context"
  ],
  "improvements": [
    "Could elaborate more on the outcome and metrics",
    "Consider mentioning alternative approaches considered",
    "Add quantifiable impact of the solution"
  ]
}
```

### 1.9 `GET /api/sessions/:sessionId/processing-status` — Processing Status (Polling)
```jsonc
// Response — 200 OK
{
  "sessionId": "sess_1710856200000",
  "progress": 65,                       // int 0–100
  "stages": [
    { "id": 1, "label": "Speech Recognition",       "status": "completed"  },
    { "id": 2, "label": "Text Analysis",             "status": "completed"  },
    { "id": 3, "label": "Voice Feature Extraction",  "status": "processing" },
    { "id": 4, "label": "Skill Evaluation",          "status": "pending"    }
  ],
  "completed": false
}

// When done:
{
  "sessionId": "sess_1710856200000",
  "progress": 100,
  "stages": [ /* all "completed" */ ],
  "completed": true
}
```

### 1.10 `GET /api/sessions/:sessionId/analysis` — Full Performance Analysis
```jsonc
// Response — 200 OK
{
  "sessionId": "sess_001",
  "overallScore": 7.5,                  // float 0–10
  "ratingLabel": "Good",                // "Poor" | "Below Average" | "Average" | "Good" | "Excellent"
  "dimensions": {
    "communication": 8.0,
    "confidence": 7.2,
    "technicalKnowledge": 7.8,
    "clarity": 7.5,
    "fluency": 6.9
  },
  "radarData": {
    "labels": ["Communication", "Confidence", "Technical", "Clarity", "Fluency"],
    "values": [8.0, 7.2, 7.8, 7.5, 6.9]
  },
  "aiSuggestions": [
    "Improve conciseness — some answers were longer than needed.",
    "Add more technical examples to support your claims.",
    "Reduce filler words like \"um\" and \"you know\".",
    "Structure answers using the STAR framework for behavioral questions.",
    "Practice speaking at a slightly slower pace for clarity."
  ],
  "questionBreakdown": [
    {
      "id": 1,
      "question": "Tell me about a project where you solved a difficult problem.",
      "score": 7.8,
      "status": "good",                 // "excellent" | "good" | "needs-improvement"
      "topic": "Problem Solving"
    }
    // ... more questions
  ]
}
```

### 1.11 `GET /api/sessions` — Interview History
```jsonc
// Request query: ?page=1&limit=10

// Response — 200 OK
{
  "sessions": [
    {
      "id": "sess_001",
      "role": "Senior Frontend Engineer",
      "category": "Technical",
      "date": "2023-10-24",
      "duration": "45 mins",
      "overallScore": 7.5,
      "status": "passed",              // "excellent" | "passed" | "borderline" | "failed"
      "summary": "Demonstrated strong proficiency in React hooks and state management..."
    }
    // ... more sessions
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 24,
    "totalPages": 3
  }
}
```

### 1.12 `GET /api/sessions/:sessionId/review` — Session Review
```jsonc
// Response — 200 OK
{
  "id": "sess_001",
  "role": "Senior Frontend Engineer",
  "date": "2023-10-24",
  "duration": "45 mins",
  "overallScore": 7.5,
  "questions": [
    {
      "id": 1,
      "question": "Tell me about a project where you solved a difficult problem.",
      "transcript": "In my final year project I developed a web application using React and Node.js...",
      "score": 7.8,
      "feedback": "Good structure and technical depth. Consider adding quantifiable outcomes.",
      "strengths": ["Clear narrative", "Technical terminology"],
      "improvements": ["Add metrics/outcomes"]
    }
    // ... more questions
  ]
}
```

### 1.13 `GET /api/dashboard` — Dashboard Summary
```jsonc
// Response — 200 OK
{
  "recentSessions": [
    {
      "id": "sess_001",
      "title": "Senior Software Engineer Mock",
      "date": "Yesterday at 2:30 PM",
      "duration": "15 mins",
      "score": 88                       // int 0–100 (dashboard uses percentage)
    }
  ],
  "analytics": {
    "totalSessions": 12,
    "averageScore": 7.4,
    "mostImproved": "Communication",
    "focusArea": "Technical Depth"
  }
}
```

### 1.14 `GET /api/analytics` — Full Analytics
```jsonc
// Response — 200 OK
{
  "totalSessions": 12,
  "averageScore": 7.4,
  "mostImproved": "Communication",
  "focusArea": "Technical Depth",
  "scoreTrend": [
    { "month": "Jul", "score": 5.8 },
    { "month": "Aug", "score": 6.3 }
    // ... more months
  ],
  "weakAreas": [
    { "area": "Technical Depth", "frequency": 7 },
    { "area": "Conciseness", "frequency": 5 }
    // ... more areas
  ],
  "competencyAverages": {
    "communication": 7.8,
    "confidence": 7.0,
    "technical": 6.5,
    "clarity": 7.3,
    "fluency": 7.1
  }
}
```

### 1.15 `GET /api/resources` — Learning Resources
```jsonc
// Response — 200 OK
{
  "resources": [
    {
      "id": 1,
      "title": "Mastering the STAR Interview Method",
      "description": "A comprehensive guide to structuring behavioral interview answers...",
      "category": "Communication",
      "difficulty": "Beginner",
      "url": "https://example.com/star-method"
    }
    // ... more resources
  ]
}
```

### 1.16 `POST /api/uploads/jd` — Upload Job Description
```jsonc
// Request — multipart/form-data
// Field: "file" — PDF/DOC/DOCX/TXT (max 10MB)

// Response — 200 OK
{
  "fileId": "file_xyz789",
  "filename": "job-spec-v2.pdf",
  "sizeBytes": 245000,
  "mimeType": "application/pdf"
}

// Response — 415 Unsupported Media Type
{
  "error": "INVALID_FILE_TYPE",
  "message": "Only PDF, DOC, DOCX, and TXT files are accepted."
}
```

### 1.17 `GET /api/settings` + `PUT /api/settings`
```jsonc
// GET Response — 200 OK
{
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "preferredRole": "Frontend Developer",
  "theme": "light",                    // "light" | "dark" | "system"
  "notifications": {
    "sessionReminders": true,
    "weeklyProgress": true,
    "newResources": false
  }
}

// PUT Request — same shape
// PUT Response — 200 OK
{ "success": true }
```

### Standard Error Envelope (all endpoints)
```jsonc
{
  "error": "ERROR_CODE",               // machine-readable code
  "message": "Human-readable description.",
  "details": {}                         // optional — field-level validation errors
}
```

HTTP codes used: `200`, `201`, `400`, `401`, `403`, `404`, `413`, `415`, `422`, `500`

---

## 2. Auth Choice & Protected-Route Behavior

### Recommendation: **JWT with HTTP-only refresh token**

| Aspect | Decision |
|---|---|
| **Strategy** | Short-lived access token (15min) + long-lived refresh token (7 days) |
| **Access token storage** | In-memory (React state / context) — never in localStorage |
| **Refresh token storage** | HTTP-only secure cookie (set by backend, auto-sent by browser) |
| **Token refresh** | Silent refresh via `POST /api/auth/refresh` — interceptor auto-retries failed 401 requests |
| **Auth endpoints** | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` |

### Protected Route Behavior

```
                     ┌──────────────┐
                     │  App Loads   │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │ Has token?   │──── No ───→ Redirect to /login
                     └──────┬───────┘
                            │ Yes
                     ┌──────▼──────────┐
                     │ Token expired?  │──── Yes ──→ Try silent refresh
                     └──────┬──────────┘             │
                            │ No                     ├─ Success → Continue
                            │                        └─ Fail → Redirect to /login
                     ┌──────▼───────┐
                     │ Render page  │
                     └──────────────┘
```

**Public routes (no auth required):** `/`, `/login`, `/register`
**Protected routes (auth required):** Everything else (`/dashboard`, `/setup`, `/interview`, `/processing`, `/summary`, `/results`, `/history`, `/history/:id`, `/analytics`, `/resources`, `/settings`)

**Frontend implementation:**
- Create an `AuthContext` providing `{ user, login, logout, isAuthenticated }`
- Create a `<ProtectedRoute>` wrapper component that checks `isAuthenticated`
- Add an axios/fetch interceptor that:
  1. Attaches `Authorization: Bearer <accessToken>` to all API requests
  2. On 401 response: calls `/api/auth/refresh`, retries the original request
  3. On refresh failure: clears auth state, redirects to `/login`

---

## 3. Upload Flows

### 3.1 Audio Upload (during interview)

```
┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐
│  User clicks │    │ MediaRecorder│    │  POST /api/sessions  │
│  Stop (⏹)    │───→│  .stop()     │───→│  /:id/questions/:qid │
│              │    │  →  Blob     │    │  /audio              │
└──────────────┘    └──────────────┘    └──────────┬──────────┘
                                                    │
                                           ┌────────▼────────┐
                                           │ Navigate to     │
                                           │ /processing     │
                                           └─────────────────┘
```

| Step | Detail |
|---|---|
| **1. Capture** | `navigator.mediaDevices.getUserMedia({ audio: true })` → `MediaRecorder` with `mimeType: 'audio/webm;codecs=opus'` |
| **2. Collect** | Accumulate chunks in `dataavailable` event → combine into single `Blob` on stop |
| **3. Upload** | `POST` as `multipart/form-data` with field name `audio` |
| **4. Constraints** | Max file size: **25 MB**. Backend expects 16kHz mono (will resample if needed) |
| **5. Error handling** | Show mic-permission-denied error if `getUserMedia` throws. Show upload-failed error with retry on network failure |
| **6. Retry** | If upload fails, store blob in memory, show "Upload failed — Retry?" button before navigating |

### 3.2 Job Description Upload (setup page)

| Step | Detail |
|---|---|
| **1. Select** | File input accepts `.pdf, .doc, .docx, .txt` |
| **2. Upload** | `POST /api/uploads/jd` as `multipart/form-data`, field name `file` |
| **3. Response** | Get back `fileId` — store it in setup form state |
| **4. On submit** | Pass `jobDescriptionFileId` in the `POST /api/sessions` payload |
| **5. Constraints** | Max file size: **10 MB**. Validate client-side before uploading |
| **6. UI feedback** | Show upload progress bar, filename after success, error message on failure |

---

## 4. Processing-Status Behavior: Polling vs WebSocket

### Recommendation: **Polling** (simpler for academic project)

| Aspect | Decision |
|---|---|
| **Method** | HTTP polling via `GET /api/sessions/:id/processing-status` |
| **Interval** | Every **2 seconds** |
| **Start** | When `AIProcessingPage` mounts |
| **Stop** | When `response.completed === true` |
| **Navigate** | After `completed === true` → wait 1s → navigate to `/summary` |
| **Timeout** | If no completion after **120 seconds**: show error state with "Processing is taking longer than expected" and a retry button |
| **Cleanup** | `clearInterval` on unmount to prevent memory leaks |

**Frontend pseudo-code:**
```javascript
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetchProcessingStatus(sessionId);
    setStages(status.stages);
    setProgress(status.progress);
    
    if (status.completed) {
      clearInterval(interval);
      setTimeout(() => navigate('/summary'), 1000);
    }
  }, 2000);

  // Timeout failsafe
  const timeout = setTimeout(() => {
    clearInterval(interval);
    setError('Processing timeout');
  }, 120000);

  return () => { clearInterval(interval); clearTimeout(timeout); };
}, [sessionId]);
```

> **Why not WebSocket?** For an 8th-semester project with limited time, polling is simpler to implement on both frontend and backend, easier to debug, and sufficient for a demo. WebSocket can be upgraded to later if needed.

---

## 5. Error States & Empty States per Page

### Existing Components

| Component | Props | Use Case |
|---|---|---|
| `EmptyState` | `icon`, `title`, `message`, `action: { label, onClick }` | No data to show |
| `ErrorState` | `title`, `message`, `onRetry` | API failure / unexpected error |
| `LoadingState` | `message` | Data loading in progress |

### Per-Page State Map

| Page | Loading State | Empty State | Error State |
|---|---|---|---|
| **Landing** `/` | None (static content) | N/A | N/A |
| **Dashboard** `/dashboard` | `<LoadingState message="Loading dashboard..." />` | `<EmptyState icon="🎯" title="No sessions yet" message="Start your first practice interview to see your progress here." action={{ label: "Start Practice", onClick: → /setup }} />` | `<ErrorState title="Failed to load dashboard" message="We couldn't fetch your data. Please check your connection." onRetry={refetch} />` |
| **Setup** `/setup` | None (static form) | N/A | Toast/inline error if session creation fails: "Failed to create interview session. Please try again." |
| **Interview** `/interview` | `<LoadingState message="Loading questions..." />` | N/A (always has questions if session created) | `<ErrorState title="Questions couldn't be loaded" message="Something went wrong fetching your interview questions." onRetry={refetchQuestions} />` + Mic permission denied: inline banner "Microphone access is required for the interview. Please grant permission in your browser settings." |
| **Processing** `/processing` | Built-in (animated progress stages) | N/A | Timeout after 120s: "Processing is taking longer than expected." + `onRetry` restarts polling. API failure: "Processing failed. Please try again." + button to go back to `/setup` |
| **Summary** `/summary` | `<LoadingState message="Loading summary..." />` | N/A | `<ErrorState title="Summary unavailable" message="We couldn't generate a summary for this question." onRetry={refetch} />` |
| **Results** `/results` | `<LoadingState message="Generating analysis..." />` | N/A (always has data if session completed) | `<ErrorState title="Analysis failed" message="Performance analysis couldn't be loaded." onRetry={refetch} />` |
| **History** `/history` | `<LoadingState message="Loading history..." />` | `<EmptyState icon="📋" title="No interview history" message="Complete your first practice session to see your history here." action={{ label: "Start Practice", onClick: → /setup }} />` | `<ErrorState title="Couldn't load history" message="There was a problem fetching your past sessions." onRetry={refetch} />` |
| **Session Review** `/history/:id` | `<LoadingState message="Loading session..." />` | N/A | `<ErrorState title="Session not found" message="This session may have been deleted or doesn't exist." />` (no retry, show "Back to History" button) |
| **Analytics** `/analytics` | `<LoadingState message="Crunching numbers..." />` | `<EmptyState icon="📊" title="Not enough data" message="Complete at least 3 practice sessions to see analytics and trends." action={{ label: "Start Practice", onClick: → /setup }} />` | `<ErrorState title="Analytics unavailable" message="Failed to load your performance analytics." onRetry={refetch} />` |
| **Resources** `/resources` | `<LoadingState message="Loading resources..." />` | `<EmptyState icon="📚" title="No resources available" message="Resources will appear here once they are added." />` | `<ErrorState title="Couldn't load resources" message="There was a problem loading learning resources." onRetry={refetch} />` |
| **Settings** `/settings` | `<LoadingState message="Loading settings..." />` | N/A (always has default values) | Toast on save failure: "Failed to save settings. Please try again." |

### Global Error Handling

| Scenario | Frontend Behavior |
|---|---|
| **401 Unauthorized** | Interceptor attempts token refresh → if fails, redirect to `/login` with toast "Session expired, please login again." |
| **403 Forbidden** | Show `<ErrorState title="Access denied" message="You don't have permission to view this page." />` |
| **404 Not Found** | Show `<ErrorState title="Page not found" message="The page you're looking for doesn't exist." />` with "Go Home" button |
| **500 Server Error** | Show `<ErrorState title="Server error" message="Something went wrong on our end. Please try again later." onRetry={refetch} />` |
| **Network Disconnected** | Toast notification: "You appear to be offline. Please check your connection." — auto-dismiss when reconnected |
| **Mic Permission Denied** | Inline error banner on Interview page (not a modal) with link to browser settings instructions |
