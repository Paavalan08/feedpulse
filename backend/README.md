# FeedPulse Backend

Express + TypeScript API for FeedPulse.

## Features

- Feedback CRUD endpoints
- Admin login with JWT
- Gemini AI analysis on feedback submission
- Weekly summary endpoint
- MongoDB persistence with Mongoose

## Environment Variables

Create `backend/.env` using `backend/.env.example` and set:

- `PORT=4000`
- `MONGO_URI=your_mongodb_connection_string`
- `GEMINI_API_KEY=your_google_gemini_api_key`
- `JWT_SECRET=your_random_jwt_secret`

## Run Locally

```bash
npm install
npm run dev
```

## Build and Start

```bash
npm run build
npm start
```

## API Base URL

`http://localhost:4000`

See root README for full project setup and screenshots.
