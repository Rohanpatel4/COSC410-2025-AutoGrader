# COSC410 AutoGrader

Autograding system for coding-based classes using Piston for code execution.

## For inspect_db.py, seed_db.py, and rebuilding frontend
```bash
# this to run inspect_db, make sure docker container is running when you do
# run all of these from the project root
docker compose cp inspect_db.py backend:/app/inspect_db.py
docker compose exec backend sh -lc \
  'python /app/inspect_db.py --url sqlite:///backend/app.db --limit 10'

# if you make changes to the frontend
# first save, then rebuild(run command below), then test before you push it (obviously)
# also note that when you pull frontend changes from the repo, run this command first thing
docker compose up --build -d frontend

# seed_db
# there's probably a better way to do this, but this method works
docker-compose cp seed_db.py backend:/app/seed_db.py # first copy it
docker-compose exec backend python seed_db.py # then run with exec

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
npm test # this to run tests
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
# visit http://localhost:5173 for frontend
# backend API: http://localhost:8000/docs
# Piston API: http://localhost:2000/api/v2/runtimes
```

# Run pytest with coverage (shows % covered per file) (From root directory)
pytest --cov=app backend

# Run pytest with coverage and see missing lines (From root directory)
pytest --cov=app --cov-report=term-missing backend

# Run pytest with coverage and fail if coverage < 90% (From root directory)
pytest --cov=app --cov-report=term-missing --cov-fail-under=90 backend