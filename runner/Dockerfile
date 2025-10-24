FROM python:3.12-slim

# install docker CLI to control the inner daemon
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y docker-ce-cli && \
    apt-get purge -y curl gnupg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# only copy the file we actually need
COPY runner.py /app/runner.py

RUN mkdir -p /runner/tmp

CMD ["python", "/app/runner.py"]

