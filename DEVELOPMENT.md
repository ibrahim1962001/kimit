# KIMIT.CLOUD — Development Guide (v2)

## Architecture

| Component | Path | Port |
|-----------|------|------|
| Main app | `datapath-app/` | 5173 |
| Admin panel | `admin-dashboard/` | 5173 (separate run) |
| API | `backend/` | 8000 |
| PostgreSQL | Docker `db` | 5432 |
| MinIO | Docker `minio` | 9000 / 9001 |
| Redis / Celery | Docker | 6379 |
| Metabase | Docker | 3000 |

## Quick start (full stack)

```bash
# Infrastructure
docker-compose up -d

# Backend
cd backend
cp .env.example .env   # edit GROQ_API_KEY, Firebase JSON path
pip install -r requirements.txt
alembic upgrade head   # or auto-create on startup
python -m app.run

# Frontend
cd datapath-app && npm install && npm run dev

# Admin
cd admin-dashboard && npm install && npm run dev
```

## API routes (v2)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/sync` | Firebase | User + welcome credits |
| POST | `/api/upload` | Firebase | Deducts credits, persists MinIO |
| POST | `/api/clean` | Firebase | |
| POST | `/api/ai/summary` | Firebase | Groq |
| POST | `/api/ai/chat` | Firebase | Groq + DB history |
| GET | `/api/credits/balance` | Firebase | |
| GET/POST | `/admin/*` | Admin Firebase | |
| POST | `/api/charge-requests` | Firebase | Manual top-up |

Legacy (guest / large files): `/api/upload/large`, `/api/files/*`

## Credits

| Action | Cost |
|--------|------|
| Welcome bonus | +10 |
| Upload / Sheets import | 1 |
| Clean | 0.5 |
| AI summary | 2 |
| AI chat message | 0.5 |

## Environment

See `backend/.env.example` and `datapath-app/.env` (`VITE_API_URL`, `VITE_FIREBASE_*`).

## Migrations

```bash
cd backend
alembic upgrade head
alembic revision --autogenerate -m "description"
```

## Tests & CI

```bash
cd backend && pytest tests/ -q
```

GitHub Actions: `.github/workflows/ci.yml`
