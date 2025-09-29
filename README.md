# Offline Sandbox (MVP)

## Run locally
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head || true
python -m app.main
# Frontend
cd ../frontend
npm i
export VITE_API_URL=http://localhost:8000
# frontend url: http://localhost:5173/ and Ian Test
npm run dev
```

## Tests & Coverage
```bash
# Backend
cd backend
pytest -q --cov=app --cov-report=term-missing:skip-covered --cov-report=html --cov-fail-under=80
# Frontend
cd ../frontend
npm run test:cov
```

## Docker
```bash
docker compose up --build
# visit http://localhost:8080
```
