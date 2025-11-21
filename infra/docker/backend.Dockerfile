FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy the entire backend directory
COPY backend /app/backend

# Set working directory to backend
WORKDIR /app/backend

# Expose port 8000
EXPOSE 8000

# Create startup script that initializes DB and starts server
RUN echo '#!/bin/bash\n\
set -e\n\
echo "[startup] Initializing database..."\n\
python /app/backend/scripts/init_db.py || echo "[startup] Warning: Database initialization had issues, continuing..."\n\
echo "[startup] Starting server..."\n\
exec uvicorn app.api.main:app --host 0.0.0.0 --port 8000\n\
' > /app/start.sh && chmod +x /app/start.sh

# Run startup script
CMD ["/app/start.sh"]

