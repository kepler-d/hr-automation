FROM node:20-slim

WORKDIR /app

# Install system packages, python3, and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment to install reportlab safely
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy python dependencies file and install
COPY requirements.txt .
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir -r requirements.txt

# Copy package files and install node dependencies
COPY package*.json ./
RUN npm install

# Copy remaining code
COPY . .

EXPOSE 8000

CMD ["node", "index.js"]
