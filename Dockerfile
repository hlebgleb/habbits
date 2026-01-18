FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Use gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:3000", "--workers", "2", "--threads", "4", "server:app"]
