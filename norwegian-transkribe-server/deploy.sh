#!/bin/bash

# Norwegian Whisper API Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment of Norwegian Whisper API..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads cache logs/nginx logs/api logs/whisper ssl

# Set permissions
echo "🔒 Setting permissions..."
chmod 755 uploads cache logs
chmod -R 755 logs/

# Copy environment files if they don't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    echo "Press Enter to continue after editing .env..."
    read
fi

# Pull latest images and build
echo "🔧 Building Docker images..."
docker-compose pull
docker-compose build --no-cache

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
docker-compose ps

# Test API endpoints
echo "🧪 Testing API endpoints..."
sleep 10

# Test health endpoints
echo "Testing Node.js API health..."
curl -f http://localhost/health || echo "❌ Node.js API health check failed"

echo "Testing Whisper service health..."
curl -f http://localhost/api/status || echo "❌ Whisper service health check failed"

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your Norwegian Whisper API is running at:"
echo "   - Main API: http://your-server-ip/"
echo "   - Health check: http://your-server-ip/health"
echo "   - Service status: http://your-server-ip/status"
echo "   - Transcription: POST http://your-server-ip/transcribe"
echo ""
echo "📖 View logs with: docker-compose logs -f"
echo "🛑 Stop services with: docker-compose down"
echo ""
echo "🎉 Happy transcribing! 