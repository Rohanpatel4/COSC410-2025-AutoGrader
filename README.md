# Offline Sandbox (MVP)

## Run locally
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head || true
python -m app.main
uvicorn app.api.main_mock:app --reload # this to run mock backend
uvicorn app.api.main:app --reload # this to run backend
# Frontend
cd ../frontend
npm i
export VITE_API_URL=http://localhost:8000
# frontend url: http://localhost:5173/ and Ian Test
npm run dev # this to run frontend
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

# Run pytest with coverage (shows % covered per file) (From root directory)
pytest --cov=app backend

# Run pytest with coverage and see missing lines (From root directory)
pytest --cov=app --cov-report=term-missing backend

# Run pytest with coverage and fail if coverage < 90% (From root directory)
pytest --cov=app --cov-report=term-missing --cov-fail-under=90 backend