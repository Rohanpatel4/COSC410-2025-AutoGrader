FROM python:3.12-alpine
RUN pip install --no-cache-dir pytest==8.3.*
WORKDIR /work
ENTRYPOINT ["pytest", "-q", "--maxfail=1", "--disable-warnings"]
