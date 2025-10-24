FROM python:3.9-slim

WORKDIR /app

RUN pip install --no-cache-dir Flask==2.2.5

ENV PYTHONPATH=/app

CMD ["python", "-m", "integration_bridge.api_server"]

