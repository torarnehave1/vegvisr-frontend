#!/bin/bash

# Setup Ollama for Norwegian Text Improvement
# Run this script on your server to install Ollama and download the Norwegian model

echo "🚀 Installing Ollama..."

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
sudo systemctl start ollama
sudo systemctl enable ollama

# Wait for service to start
sleep 5

echo "📥 Downloading Mistral 7B model (smaller, fits in 4GB memory)..."

# Download the smaller model that fits in available memory
ollama pull mistral:7b

echo "✅ Ollama setup complete!"

# Test the installation
echo "🧪 Testing Ollama installation..."

curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral:7b",
    "prompt": "Test: Forbedre denne teksten: Dette er en test.",
    "stream": false
  }'

echo ""
echo "🎉 If you see a JSON response above, Ollama is working correctly!"
echo ""
echo "💡 Memory usage:"
echo "   - Mistral 7B: ~4GB (fits in your available 5.4GB)"
echo "   - Leaves memory for whisper service and system"
echo ""
echo "💡 Your whisper service will now provide both:"
echo "   - Raw Norwegian transcription"
echo "   - AI-improved readable text (via Mistral 7B)"
echo ""
echo "ℹ️  Note: If Ollama is not running, the service will still work but only provide raw transcription." 