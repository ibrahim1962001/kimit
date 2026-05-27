# Kimit AI Studio

**Kimit** is a browser-first data analytics platform: upload CSV/Excel, get an auto-built Smart Dashboard, clean data, chat with AI, and export Excel + interactive HTML — without installing desktop software.

- **Live app:** [https://kimit.cloud](https://kimit.cloud)
- **Repository:** [github.com/ibrahim1962001/kimit](https://github.com/ibrahim1962001/kimit)

## Features

- Smart Dashboard (up to 6 auto charts by data domain)
- Local-first analysis for files under 10MB (optional cloud backup)
- Data cleaning, comparison, Excel editor with live sync
- AI chat (Groq) with dataset context
- Arabic & English UI
- Export: CSV, JSON, Excel, Smart Dashboard bundle (`.xlsx` + `.html`)

## Project structure

| Path | Description |
|------|-------------|
| `datapath-app/` | Main React + Vite app (Firebase Hosting) |
| `backend/` | FastAPI API — auth, uploads, credits, AI, MinIO |
| `admin-dashboard/` | Admin panel (users, credits) |
| `excel-addin/` | Optional Office.js task pane (advanced Excel sync) |
| `docker-compose.yml` | Postgres, MinIO, Redis, Celery, Metabase |

## Quick start

### Frontend only (local analysis)

```bash
cd datapath-app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Full stack

```bash
docker-compose up -d
cd backend && pip install -r requirements.txt && cp .env.example .env
cd backend && alembic upgrade head && python -m app.run
cd datapath-app && npm install && npm run dev
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for API routes, credits, and environment variables.

## Deploy

```bash
cd datapath-app && npm run build
firebase deploy --only hosting
```

## Privacy model

- **Default:** files &lt; 10MB are parsed in the browser; row data is not uploaded unless you enable *Optional cloud backup* on the home page.
- **Large files (&gt; 10MB):** processed on Kimit servers for performance.
- **AI Chat:** sends excerpts to Groq — see [SECURITY.md](./SECURITY.md) and in-app Privacy page.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
