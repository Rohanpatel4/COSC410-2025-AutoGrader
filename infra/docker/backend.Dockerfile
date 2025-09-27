# infra/docker/backend.Dockerfile
FROM python:3.11-slim AS base
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend /app
ENV DATABASE_URL=sqlite:///./app.db
EXPOSE 8000
CMD ["python","-m","app.main"]
