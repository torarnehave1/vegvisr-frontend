# Whisper API

This repository contains a containerized API service for speech-to-text transcription using OpenAI's Whisper model. The project is structured with a Node.js/Express API, a Python backend for Whisper, and Nginx for reverse proxying.

## Project Structure

- `api/` - Node.js/Express API server
- `whisper/` - Python service running Whisper
- `nginx/` - Nginx configuration for reverse proxy
- `docker-compose.yml` - Multi-service orchestration
- `deploy.sh`, `setup-server.sh` - Deployment scripts

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js (for local API development)
- Python 3.8+ (for local Whisper service development)

### Environment Variables
Copy `.env.example` to `.env` and update as needed.

```
cp env.example .env
```

### Build and Run with Docker Compose

```
docker-compose up --build
```

This will start all services: API, Whisper backend, and Nginx.

### API Usage
- The API is available at `http://localhost:8080` (or as configured in Nginx)
- See `api/server.js` for available endpoints

### Testing

Run the test script:

```
./test-api.sh
```

## Development

- Node.js API: edit files in `api/` and restart the container or use `nodemon` for hot reload
- Whisper Python service: edit files in `whisper/` and restart the container
- Nginx: edit configs in `nginx/` and restart the container

## Deployment

Use `deploy.sh` and `setup-server.sh` for server setup and deployment automation.

## License

MIT License
