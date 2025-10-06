# Judge0 API/worker image + Docker CLI
FROM judge0/judge0:latest

# Become root to install packages
USER root

# Use archived Debian repositories (Buster is EOL)
RUN sed -i 's|deb.debian.org|archive.debian.org|g' /etc/apt/sources.list && \
    sed -i 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list && \
    echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until && \
    apt-get update && \
    apt-get install -y --no-install-recommends docker.io && \
    rm -rf /var/lib/apt/lists/*

# Drop back to the judge0 user
USER judge0
