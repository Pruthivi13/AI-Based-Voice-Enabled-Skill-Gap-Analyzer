# Backend Implementation Reference — AI Interview Analysis Platform

This document is the single source of truth for the backend MVP.
It consolidates:
- architecture
- authentication approach
- Prisma schema
- API route contract
- module structure
- Firebase integration behavior
- implementation order
- validation and security rules

Use this as the backend engineering spec for the IDE agent.

---

# 1. Backend Scope

The backend is responsible for:
- verifying authenticated users via Firebase
- creating and syncing internal user records
- storing user profile and settings
- creating interview sessions
- serving interview questions
- accepting uploaded audio responses
- storing transcript and analysis results
- generating final reports
- exposing dashboard, history, analytics, and settings APIs

The backend is **not** responsible for:
- password hashing
- login endpoint
- refresh token endpoint
- password reset endpoint
- email verification logic

Those are handled by **Firebase Authentication**.

---

# 2. Final Auth Approach

## 2.1 Chosen approach

Use:
- **Firebase Authentication** for signup/login/password reset/email verification
- **Firebase Client SDK** in frontend
- **Firebase Admin SDK** in backend for token verification
- **PostgreSQL + Prisma** for application data

## 2.2 Frontend auth behavior

Frontend should:
- register users using Firebase email/password
- log in users using Firebase email/password
- request password reset using Firebase
- get Firebase ID token from current user
- send token in header:

```http
Authorization: Bearer <firebase_id_token>
```

## 2.3 Backend auth behavior

Backend should:
- verify the Firebase ID token on every protected request
- extract:
  - `uid`
  - `email`
  - `email_verified`
  - `name` if available
- find or create a local `User` record
- attach authenticated user context to request

## 2.4 No backend auth endpoints

Do **not** implement these endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

They are unnecessary in Firebase-based architecture.

---

# 3. Recommended Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript preferred, JavaScript acceptable
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication verification:** Firebase Admin SDK
- **File storage:** Firebase Storage
- **Validation:** Zod
- **Logging:** Morgan + custom logger
- **Security:** Helmet, CORS, express-rate-limit
- **ML service:** FastAPI (Python)
- **Queue:** optional in MVP, BullMQ + Redis later

---

# 4. Folder Structure

Recommended backend structure:

```text
backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── prisma.ts
│   │   ├── firebaseAdmin.ts
│   │   └── storage.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── requireVerifiedEmail.middleware.ts
│   │   ├── validate.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── rateLimit.middleware.ts
│   ├── modules/
│   │   ├── users/
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.routes.ts
│   │   │   └── users.schema.ts
│   │   ├── sessions/
│   │   │   ├── sessions.controller.ts
│   │   │   ├── sessions.service.ts
│   │   │   ├── sessions.routes.ts
│   │   │   └── sessions.schema.ts
│   │   ├── questions/
│   │   │   ├── questions.controller.ts
│   │   │   ├── questions.service.ts
│   │   │   └── questions.routes.ts
│   │   ├── uploads/
│   │   │   ├── uploads.controller.ts
│   │   │   ├── uploads.service.ts
│   │   │   ├── uploads.routes.ts
│   │   │   └── uploads.schema.ts
│   │   ├── analysis/
│   │   │   ├── analysis.controller.ts
│   │   │   ├── analysis.service.ts
│   │   │   └── analysis.routes.ts
│   │   ├── reports/
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   └── reports.routes.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │   └── dashboard.routes.ts
│   │   └── settings/
│   │       ├── settings.controller.ts
│   │       ├── settings.service.ts
│   │       ├── settings.routes.ts
│   │       └── settings.schema.ts
│   ├── services/
│   │   ├── mlClient.service.ts
│   │   ├── reportGenerator.service.ts
│   │   └── userSync.service.ts
│   ├── utils/
│   │   ├── apiResponse.ts
│   │   ├── apiError.ts
│   │   └── logger.ts
│   └── types/
│       └── express.d.ts
├── prisma/
│   └── schema.prisma
├── package.json
└── .env
```

---

# 5. Firebase Auth Middleware Design

## 5.1 Backend request flow

For every protected route:
1. Read `Authorization` header
2. Expect format `Bearer <token>`
3. Verify token using Firebase Admin SDK
4. Extract Firebase claims
5. Find or create local user in DB
6. Attach to `req.user`
7. Continue

## 5.2 Request user shape

Add this to request context:

```ts
interface AuthenticatedRequestUser {
  id: string;
  firebaseUid: string;
  email: string;
  emailVerified: boolean;
}
```

## 5.3 Middleware responsibilities

### `auth.middleware`
- verify Firebase token
- upsert/sync user
- attach local user to request
- reject with `401` if invalid

### `requireVerifiedEmail.middleware`
Use on sensitive routes like:
- session creation
- uploads

Reject with:

```json
{
  "error": "EMAIL_NOT_VERIFIED",
  "message": "Please verify your email before using this feature."
}
```

## 5.4 Firebase Admin init

Expected env values:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`

Remember: replace literal `\\n` in private key with actual newlines.

---

# 6. Prisma Schema

Save this as `prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ExperienceLevel {
  STUDENT
  FRESHER
  JUNIOR
  MID
  SENIOR
}

enum InterviewType {
  TECHNICAL
  HR
  COMMUNICATION
  MIXED
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum SessionStatus {
  CREATED
  IN_PROGRESS
  PROCESSING
  COMPLETED
  FAILED
}

enum QuestionCategory {
  TECHNICAL
  HR
  COMMUNICATION
  BEHAVIORAL
}

enum UploadType {
  AUDIO
  VIDEO
  DOCUMENT
}

model User {
  id            String         @id @default(cuid())
  firebaseUid   String         @unique
  email         String         @unique
  fullName      String?
  emailVerified Boolean        @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  profile       UserProfile?
  settings      UserSettings?
  sessions      InterviewSession[]
  uploads       Upload[]

  @@index([firebaseUid])
  @@index([email])
}

model UserProfile {
  id                String          @id @default(cuid())
  userId            String          @unique
  targetRole        String?
  experienceLevel   ExperienceLevel?
  preferredLanguage String          @default("en")
  resumeUrl         String?
  bio               String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  user              User            @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model UserSettings {
  id               String   @id @default(cuid())
  userId           String   @unique
  theme            String   @default("light")
  sessionReminders Boolean  @default(true)
  weeklyProgress   Boolean  @default(true)
  newResources     Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model InterviewSession {
  id              String           @id @default(cuid())
  userId          String
  title           String?
  interviewType   InterviewType
  targetRole      String
  difficulty      Difficulty
  experienceLevel ExperienceLevel?
  questionCount   Int
  status          SessionStatus    @default(CREATED)
  jobDescription  String?
  overallScore    Float?
  startedAt       DateTime         @default(now())
  endedAt         DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  responses       Response[]
  report          Report?
  uploads         Upload[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model Question {
  id               String            @id @default(cuid())
  content          String
  category         QuestionCategory
  role             String?
  difficulty       Difficulty
  expectedKeywords Json?
  timeLimitSeconds Int?              @default(120)
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  responses        Response[]

  @@index([category])
  @@index([role])
  @@index([difficulty])
  @@index([isActive])
}

model Response {
  id              String           @id @default(cuid())
  sessionId       String
  questionId      String
  answerOrder     Int
  transcript      String?
  durationSeconds Int?
  submittedAt     DateTime         @default(now())
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  session         InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question        Question         @relation(fields: [questionId], references: [id], onDelete: Restrict)
  analysis        ResponseAnalysis?
  uploads         Upload[]

  @@unique([sessionId, questionId])
  @@index([sessionId])
  @@index([questionId])
}

model ResponseAnalysis {
  id                 String   @id @default(cuid())
  responseId         String   @unique
  clarityScore       Float?
  fluencyScore       Float?
  confidenceScore    Float?
  relevanceScore     Float?
  grammarScore       Float?
  pronunciationScore Float?
  technicalScore     Float?
  fillerWordCount    Int?
  speechRateWpm      Int?
  sentiment          String?
  overallScore       Float?
  feedbackJson       Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  response           Response @relation(fields: [responseId], references: [id], onDelete: Cascade)
}

model Report {
  id                  String           @id @default(cuid())
  sessionId           String           @unique
  overallScore        Float
  ratingLabel         String?
  summary             String?
  strengthsJson       Json?
  weaknessesJson      Json?
  recommendationsJson Json?
  radarDataJson       Json?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  session             InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model Upload {
  id              String            @id @default(cuid())
  userId          String
  sessionId       String?
  responseId      String?
  type            UploadType
  fileUrl         String
  storagePath     String?
  mimeType        String?
  sizeBytes       Int?
  durationSeconds Int?
  createdAt       DateTime          @default(now())

  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  session         InterviewSession? @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  response        Response?         @relation(fields: [responseId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([sessionId])
  @@index([responseId])
  @@index([type])
}
```

---

# 7. Data Model Notes

## 7.1 User
Maps one Firebase user to one internal app user.

## 7.2 UserProfile
Stores interview personalization.

## 7.3 UserSettings
Stores settings page state.

## 7.4 InterviewSession
Represents a single interview attempt.

## 7.5 Question
Question bank table.

## 7.6 Response
One answer per question in a session.
Constraint:
- one response per `sessionId + questionId`

## 7.7 ResponseAnalysis
Stores AI analysis for one response.

## 7.8 Report
Stores final aggregated session report.

## 7.9 Upload
Tracks uploaded audio/video/document files.

---

# 8. Route Contract

All routes are prefixed with `/api`.
All routes below are protected unless marked public.
All protected routes require:

```http
Authorization: Bearer <firebase_id_token>
```

## Standard success style
Use plain JSON objects. No need for nested `data` envelope unless the team prefers it consistently.

## Standard error envelope

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description.",
  "details": {}
}
```

---

## 8.1 Users

### `GET /api/users/me`
Purpose:
- verify token
- sync local user
- return current user + profile + settings

Auth:
- required

Response:

```json
{
  "id": "usr_123",
  "firebaseUid": "firebase_uid_abc",
  "email": "alex@example.com",
  "fullName": "Alex Johnson",
  "emailVerified": true,
  "profile": {
    "targetRole": "Frontend Developer",
    "experienceLevel": "STUDENT",
    "preferredLanguage": "en",
    "resumeUrl": null,
    "bio": null
  },
  "settings": {
    "theme": "light",
    "sessionReminders": true,
    "weeklyProgress": true,
    "newResources": false
  }
}
```

### `PUT /api/users/me`
Purpose:
- update current user profile and settings

Auth:
- required

Request:

```json
{
  "fullName": "Alex Johnson",
  "profile": {
    "targetRole": "Frontend Developer",
    "experienceLevel": "STUDENT",
    "preferredLanguage": "en",
    "resumeUrl": null,
    "bio": "Interested in frontend engineering"
  },
  "settings": {
    "theme": "dark",
    "sessionReminders": true,
    "weeklyProgress": false,
    "newResources": true
  }
}
```

Response:
- same shape as `GET /api/users/me`

Validation notes:
- `theme` should be `light` or `dark`
- `experienceLevel` must match enum
- email is read-only here

---

## 8.2 Sessions

### `POST /api/sessions`
Purpose:
- create interview session

Auth:
- required
- recommended to require verified email

Request:

```json
{
  "interviewType": "TECHNICAL",
  "targetRole": "Frontend Developer",
  "difficulty": "MEDIUM",
  "experienceLevel": "STUDENT",
  "questionCount": 5,
  "jobDescription": "Optional JD text"
}
```

Response:

```json
{
  "sessionId": "sess_123",
  "status": "CREATED"
}
```

Validation notes:
- `questionCount` range recommended: 1 to 10
- enums must match schema

### `GET /api/sessions`
Purpose:
- paginated session history for current user

Auth:
- required

Query params:
- `page`
- `limit`
- optional `status`

Response:

```json
{
  "items": [
    {
      "id": "sess_123",
      "title": "Frontend Technical Practice",
      "interviewType": "TECHNICAL",
      "targetRole": "Frontend Developer",
      "difficulty": "MEDIUM",
      "status": "COMPLETED",
      "overallScore": 8.3,
      "startedAt": "2026-03-19T10:30:00Z",
      "endedAt": "2026-03-19T10:50:00Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 12,
  "hasMore": true
}
```

### `GET /api/sessions/:id`
Purpose:
- get session metadata

Auth:
- required

Ownership:
- user must own session

Response:

```json
{
  "id": "sess_123",
  "title": "Frontend Technical Practice",
  "interviewType": "TECHNICAL",
  "targetRole": "Frontend Developer",
  "difficulty": "MEDIUM",
  "experienceLevel": "STUDENT",
  "questionCount": 5,
  "status": "PROCESSING",
  "overallScore": null,
  "startedAt": "2026-03-19T10:30:00Z",
  "endedAt": null
}
```

### `GET /api/sessions/:id/questions`
Purpose:
- get questions for a session

Auth:
- required

Ownership:
- user must own session

Response:

```json
[
  {
    "id": "q1",
    "content": "Tell me about yourself.",
    "category": "COMMUNICATION",
    "difficulty": "EASY",
    "timeLimitSeconds": 120
  }
]
```

Implementation note:
- for MVP, questions can be selected when session is created and returned here
- if persistent order is needed later, add a `SessionQuestion` table in a future migration

### `POST /api/sessions/:id/finish`
Purpose:
- mark session complete from frontend side after all answers submitted
- backend should move state to `PROCESSING`

Auth:
- required

Ownership:
- user must own session

Response:

```json
{
  "success": true,
  "status": "PROCESSING"
}
```

---

## 8.3 Uploads / Responses

### `POST /api/sessions/:id/questions/:qid/audio`
Purpose:
- upload audio answer for a question
- create or update `Response`
- create `Upload`
- optionally trigger transcription/analysis

Auth:
- required
- recommended to require verified email

Content type:
- `multipart/form-data`

Form fields:
- `audio`: File
- optional `answerOrder`: number
- optional `durationSeconds`: number

Constraints:
- max size: 25 MB
- preferred format: `audio/webm`
- accepted MIME types should be explicitly whitelisted

Response:

```json
{
  "success": true,
  "responseId": "resp_123",
  "uploadId": "upl_123"
}
```

Errors:

```json
{
  "error": "FILE_TOO_LARGE",
  "message": "Audio file exceeds the 25 MB limit."
}
```

```json
{
  "error": "UNSUPPORTED_AUDIO_FORMAT",
  "message": "Unsupported audio format."
}
```

### `GET /api/sessions/:id/questions/:qid/transcript`
Purpose:
- fetch saved transcript for the response

Auth:
- required

Ownership:
- user must own session

Response:

```json
{
  "transcript": "I am a frontend developer passionate about building accessible interfaces."
}
```

### `GET /api/sessions/:id/questions/:qid/summary`
Purpose:
- fetch per-question summary

Auth:
- required

Ownership:
- user must own session

Response:

```json
{
  "responseId": "resp_123",
  "transcript": "I am a frontend developer...",
  "analysis": {
    "clarityScore": 8.2,
    "fluencyScore": 7.8,
    "confidenceScore": 7.4,
    "relevanceScore": 8.0,
    "grammarScore": 7.9,
    "pronunciationScore": 7.5,
    "technicalScore": 8.1,
    "fillerWordCount": 5,
    "speechRateWpm": 132,
    "overallScore": 8.0,
    "feedback": [
      "Clear answer structure",
      "Add one stronger example"
    ]
  }
}
```

---

## 8.4 Analysis / Reports

### `GET /api/sessions/:id/processing-status`
Purpose:
- poll backend while analysis is running

Auth:
- required

Ownership:
- user must own session

Response:

```json
{
  "stages": [
    { "stage": "upload", "status": "completed", "label": "Audio uploaded" },
    { "stage": "transcription", "status": "in_progress", "label": "Generating transcript" },
    { "stage": "analysis", "status": "pending", "label": "Running AI analysis" },
    { "stage": "report", "status": "pending", "label": "Preparing summary" }
  ],
  "progress": 45,
  "completed": false
}
```

### `GET /api/sessions/:id/analysis`
Purpose:
- fetch final aggregated session analysis
- used by summary/results page

Auth:
- required

Ownership:
- user must own session

Response:

```json
{
  "sessionId": "sess_123",
  "overallScore": 8.3,
  "ratingLabel": "Good",
  "summary": "Strong communication with room to improve confidence.",
  "strengths": ["Clarity", "Communication"],
  "weaknesses": ["Confidence"],
  "recommendations": [
    "Practice concise introductions",
    "Use measurable examples"
  ]
}
```

### `GET /api/sessions/:id/review`
Purpose:
- fetch full session review with question breakdown

Auth:
- required

Ownership:
- user must own session

Response:

```json
{
  "session": {
    "id": "sess_123",
    "title": "Frontend Technical Practice",
    "date": "2026-03-19T10:30:00Z",
    "duration": 820,
    "score": 8.4
  },
  "questions": [
    {
      "id": "q1",
      "content": "Tell me about yourself.",
      "transcript": "I am a frontend developer...",
      "score": 8.0,
      "feedback": ["Good structure", "Add more measurable impact"]
    }
  ]
}
```

---

## 8.5 Dashboard / Analytics / Resources / Settings

### `GET /api/dashboard`
Purpose:
- dashboard home data

Auth:
- required

Response:

```json
{
  "recentSessions": [
    {
      "id": "sess_123",
      "title": "Frontend Technical Practice",
      "score": 8.4,
      "date": "2026-03-19T10:30:00Z"
    }
  ],
  "analytics": {
    "averageScore": 7.9,
    "totalSessions": 6,
    "focusArea": "Confidence"
  }
}
```

### `GET /api/analytics`
Purpose:
- analytics page data

Auth:
- required

Response:

```json
{
  "totalSessions": 6,
  "averageScore": 7.9,
  "mostImproved": "Clarity",
  "focusArea": "Confidence",
  "scoreTrend": [
    { "label": "Jan", "score": 6.8 },
    { "label": "Feb", "score": 7.4 },
    { "label": "Mar", "score": 7.9 }
  ],
  "weakAreas": [
    { "label": "Confidence", "count": 4 },
    { "label": "Technical Depth", "count": 3 }
  ],
  "competencyAverages": {
    "communication": 8.1,
    "confidence": 7.0,
    "technicalKnowledge": 7.6,
    "clarity": 8.2,
    "fluency": 7.9
  }
}
```

### `GET /api/resources`
Purpose:
- fetch recommended resources

Auth:
- required

Response:

```json
[
  {
    "id": "res_1",
    "title": "Improve Technical Interview Structure",
    "description": "Learn how to structure concise technical answers.",
    "category": "Interview Skills"
  }
]
```

### `GET /api/settings`
Purpose:
- fetch user settings page data

Auth:
- required

Response:

```json
{
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "preferredRole": "Frontend Developer",
  "theme": "light",
  "notifications": {
    "sessionReminders": true,
    "weeklyProgress": true,
    "newResources": false
  }
}
```

### `PUT /api/settings`
Purpose:
- update settings

Auth:
- required

Request:

```json
{
  "name": "Alex Johnson",
  "preferredRole": "Frontend Developer",
  "theme": "dark",
  "notifications": {
    "sessionReminders": true,
    "weeklyProgress": false,
    "newResources": true
  }
}
```

Response:

```json
{
  "success": true
}
```

Note:
- treat email as read-only for MVP

---

# 9. Validation Rules

Use Zod schemas per module.

## 9.1 Session creation
- `interviewType`: enum
- `difficulty`: enum
- `experienceLevel`: enum optional
- `targetRole`: non-empty string, max 100
- `questionCount`: integer 1–10
- `jobDescription`: optional string, max 10000

## 9.2 Profile/settings update
- `fullName`: max 120
- `bio`: max 1000
- `preferredLanguage`: max 20
- `theme`: `light | dark`

## 9.3 Uploads
- MIME whitelist only
- max 25 MB
- require session ownership
- require question exists

---

# 10. Ownership Rules

Every route that accesses user-scoped data must verify ownership.

Examples:
- user can only access their own sessions
- user can only access their own reports
- user can only upload to their own sessions
- user can only fetch transcript/summary for their own session responses

Implementation rule:
Always query by both:
- requested record ID
- `userId = req.user.id`

Do not fetch by record ID alone.

---

# 11. Storage Rules

Use Firebase Storage.

Recommended bucket paths:
- `users/{userId}/sessions/{sessionId}/audio/{responseId}.webm`
- `users/{userId}/sessions/{sessionId}/video/{responseId}.webm`
- `users/{userId}/documents/{uploadId}.pdf`

Store in DB:
- public or signed URL in `fileUrl`
- raw storage path in `storagePath`
- MIME type
- file size
- duration if known

For MVP:
- server-side upload is fine
- direct signed upload can come later

---

# 12. ML Integration

## 12.1 MVP approach
Use synchronous or simple async calls to a Python FastAPI service.

## 12.2 Suggested ML endpoints
These are internal backend-to-ML endpoints, not frontend routes.

- `POST /internal/transcribe`
- `POST /internal/analyze-response`
- `POST /internal/generate-report`

## 12.3 Analysis flow
1. Audio uploaded
2. Backend creates `Upload`
3. Backend creates or updates `Response`
4. Backend sends audio/transcript/question context to ML service
5. Backend stores `ResponseAnalysis`
6. After session finish, backend aggregates and stores `Report`
7. Session status becomes `COMPLETED`

## 12.4 If no queue yet
For MVP:
- when session is finished, set `PROCESSING`
- run report pipeline
- once done, store report and mark `COMPLETED`

---

# 13. Processing Status Logic

Frontend polling behavior:
- poll `GET /api/sessions/:id/processing-status`
- every 2 seconds
- stop when `completed === true`
- timeout after 120 seconds

Backend should derive progress from session/report state.

Suggested mapping:
- upload complete → response rows exist
- transcription in progress → some transcript missing
- analysis in progress → some `ResponseAnalysis` missing
- report pending → analyses done, report not stored yet
- completed → report exists and session status is `COMPLETED`

---

# 14. Security Rules

Must include:
- `helmet()`
- restricted CORS origins
- `express-rate-limit` on expensive endpoints
- file type validation
- file size validation
- centralized error handling
- no trust in frontend-provided user IDs
- ownership checks on every protected resource

Recommended rate-limited routes:
- `POST /api/sessions`
- `POST /api/sessions/:id/questions/:qid/audio`

---

# 15. Implementation Order

Use this order exactly.

## Phase 1
Core setup
- Express app
- env config
- Prisma setup
- Firebase Admin config
- error middleware
- auth middleware

## Phase 2
User sync and profile
- `GET /api/users/me`
- `PUT /api/users/me`
- default profile/settings creation

## Phase 3
Questions and sessions
- question seed data
- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `GET /api/sessions/:id/questions`

## Phase 4
Uploads and responses
- audio upload endpoint
- storage integration
- response creation
- transcript retrieval

## Phase 5
Analysis and reports
- ML service integration
- per-question summary
- processing status
- finish session
- final analysis/report
- session review

## Phase 6
Dashboard and settings
- dashboard endpoint
- analytics endpoint
- resources endpoint
- settings endpoints

---

# 16. Suggested Seed Data

Seed at least:
- 10 communication questions
- 10 HR questions
- 10 technical questions
- varying difficulties
- role-specific technical questions for frontend role

This allows session generation immediately during development.

---

# 17. Environment Variables

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/interview_ai

FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com

FRONTEND_ORIGIN=http://localhost:3000
ML_SERVICE_URL=http://localhost:8000
```

---

# 18. Prisma Commands

```bash
npm install prisma @prisma/client
npx prisma init
npx prisma format
npx prisma migrate dev --name init_mvp_schema
npx prisma generate
```

Optional seed command later:

```bash
npx prisma db seed
```

---

# 19. IDE Agent Instructions

When generating backend code from this document, follow these rules:
- use Firebase token verification only
- do not implement password-based backend auth
- use Prisma as the single DB access layer
- keep one source of truth for route shapes from this file
- enforce resource ownership on all protected routes
- use Zod for request validation
- use Firebase Storage for uploads
- keep the schema exactly as defined unless a migration is explicitly needed
- do not introduce extra tables unless necessary for MVP

---

# 20. MVP Completion Checklist

The backend MVP is complete when all items below are true:
- Firebase token verification works
- local user sync works
- user profile/settings CRUD works
- sessions can be created and listed
- questions can be served
- audio answers can be uploaded
- response rows are created
- transcript/analysis can be retrieved
- final report can be generated and fetched
- dashboard/history/settings endpoints work
- ownership and validation checks are enforced

