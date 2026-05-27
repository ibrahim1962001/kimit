# Contributing to Kimit

Thank you for improving Kimit AI Studio.

## Getting started

1. Fork the repository and clone your fork.
2. For UI work: `cd datapath-app && npm install && npm run dev`
3. For API work: see [DEVELOPMENT.md](./DEVELOPMENT.md) and run `docker-compose up -d`

## Pull requests

- Use a focused branch name, e.g. `fix/upload-privacy-copy` or `feat/export-bundle`
- Run before opening a PR:
  ```bash
  cd datapath-app && npm run build
  cd backend && pytest tests/ -q
  ```
- Describe **what** changed and **why**
- Add screenshots for UI changes

## Code style

- TypeScript: match existing patterns in `datapath-app/src`
- Python: follow FastAPI layout under `backend/app/`
- Keep user-facing copy honest about privacy (local vs cloud vs AI)
- Do not commit secrets (`.env`, Firebase service accounts, API keys)

## Reporting issues

Include: browser, steps to reproduce, file type/size, and whether cloud backup was enabled.
