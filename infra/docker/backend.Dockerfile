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

# Run uvicorn with host 0.0.0.0 to listen on all interfaces
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

