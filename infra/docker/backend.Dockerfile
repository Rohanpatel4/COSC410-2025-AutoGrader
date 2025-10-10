# infra/docker/backend.Dockerfile
FROM python:3.11-slim AS base
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend /app
RUN mkdir -p /app/data
ENV DATABASE_URL=sqlite:///./data/app.db
EXPOSE 8000
CMD ["python","-m","app.api.main"]
