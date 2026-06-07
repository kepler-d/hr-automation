FROM node:20-alpine

USER root

# Install Python 3, pip, build tools, and imaging libraries for ReportLab
RUN apk add --update --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    jpeg-dev \
    zlib-dev \
    freetype-dev \
    libffi-dev

# Install n8n globally via npm
RUN npm install -g n8n --omit=dev

# Create virtual environment and update PATH
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install python dependencies in virtualenv and set ownership to node
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir reportlab requests pandas google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client && \
    chown -R node:node /opt/venv
# Expose n8n default port
EXPOSE 5678

# Set n8n as default entrypoint command
ENTRYPOINT ["n8n"]
