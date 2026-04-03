# FeedPulse - AI-Powered Product Feedback Platform

FeedPulse is a full-stack internal tool to collect product feedback and use Google Gemini AI to auto-categorize, score priority, detect sentiment, and summarize trends.

## Tech Stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Database: MongoDB + Mongoose
- AI: Google Gemini API (gemini-1.5-flash)
- Auth: JWT-based admin protection
- Optional DevOps: Docker + Docker Compose

## Features

### Public Feedback Submission

- Public form with fields: title, description, category, name (optional), email (optional)
- Client-side validation:
  - Title required
  - Description minimum 20 characters
- Character counter on description
- Rate limiting: max 5 submissions per IP per hour
- Save feedback to MongoDB and trigger AI analysis asynchronously

### AI Analysis

- On each new feedback item, backend calls Gemini and stores:
  - ai_category
  - ai_sentiment
  - ai_priority (1-10)
  - ai_summary
  - ai_tags
- Graceful fallback: feedback is still saved even if AI fails
- On-demand summary endpoint for last 7 days feedback themes

### Admin Dashboard

- Login with hardcoded admin credentials through backend auth endpoint
- Protected dashboard via JWT middleware
- Feedback table includes:
  - title
  - category
  - sentiment badge
  - priority score
  - status
  - date
- Filters:
  - by category
  - by status
- Update feedback status (New, In Review, Resolved)

### REST API

- POST /api/feedback
- GET /api/feedback
- GET /api/feedback/:id
- PATCH /api/feedback/:id
- DELETE /api/feedback/:id
- GET /api/feedback/summary
- POST /api/auth/login

All API responses follow a consistent envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "message": "..."
}
```

## Project Structure

```text
feedpulse/
├── frontend/
│   └── src/app/
│       ├── page.tsx
│       └── dashboard/page.tsx
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── utils/
├── docker-compose.yml
└── README.md
```

## Environment Variables

Create backend env file from example:

```bash
cp backend/.env.example backend/.env
```

On Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Required values in backend/.env:

- PORT=4000
- MONGO_URI=your_mongodb_connection_string
- GEMINI_API_KEY=your_google_gemini_api_key
- JWT_SECRET=your_random_jwt_secret

Frontend optional env (for local override):

- NEXT_PUBLIC_API_URL=http://localhost:4000

## Run Locally (Without Docker)

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3) Open app

- Public form: http://localhost:3000
- Admin dashboard: http://localhost:3000/dashboard
- Backend API: http://localhost:4000

## Run With Docker Compose

```bash
docker-compose up --build
```

Services:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- MongoDB: mongodb://localhost:27017/feedpulse

Make sure GEMINI_API_KEY is available in your shell/session before running docker-compose.

## Admin Login (Demo)

- Email: admin@feedpulse.com
- Password: password123

## Screenshots

Before submission, add at least two screenshots:

1. Public feedback submission page
2. Admin dashboard page with sentiment/priority/status

## What I Would Build Next

- Move admin credentials to a User collection with hashed passwords
- Add sorting controls and keyword search in UI
- Add stats bar and richer analytics visualizations
- Add Jest + Supertest unit tests for critical API flows
- Add background job queue for AI processing retries
