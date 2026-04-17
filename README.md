# DataPath Analyzer - Autonomous Data Intelligence Platform

## Quick Start

### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The API will run at `http://localhost:8000`

### Frontend

```bash
cd datapath-app
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Features

- Upload CSV / XLS / XLSX files directly in the browser
- Automatic data cleaning and duplicate detection
- AI-driven insights and chat assistant via Groq API
- Interactive dashboard with charts and data health scoring
- Export cleaned data as CSV or JSON
- Arabic and English bilingual support

## Firebase / Deployment

- Firebase Hosting is configured in `firebase.json`
- Frontend output directory is `datapath-app/dist`
- Deploy with:

```bash
firebase deploy --only hosting
```

## Important Notes

- The frontend already includes a Firebase config file at `datapath-app/src/firebase.ts`
- The AI backend uses a Groq API key from `backend/.env`

## Project Structure

- `backend/` — FastAPI server and AI endpoints
- `datapath-app/` — React + Vite frontend application
- `firebase.json` — Firebase Hosting configuration
- `.firebaserc` — Firebase project alias
- `report.md` — project data persistence report
