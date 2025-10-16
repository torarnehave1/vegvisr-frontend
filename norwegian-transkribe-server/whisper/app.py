import os
import tempfile
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import librosa
import numpy as np
from pydub import AudioSegment
from pydub.utils import which
import gc
import time
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('./logs/whisper.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables for model
processor = None
model = None
model_loaded = False

# Configuration
MODEL_NAME = os.getenv('MODEL_NAME', 'NbAiLabBeta/nb-whisper-large')
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
CACHE_DIR = os.getenv('CACHE_DIR', './cache')
MAX_AUDIO_LENGTH = 30  # seconds

# Ensure cache directory exists
os.makedirs(CACHE_DIR, exist_ok=True)

def load_model():
    """Load the Whisper model and processor"""
    global processor, model, model_loaded
    
    if model_loaded:
        return
    
    try:
        logger.info(f"Loading model: {MODEL_NAME}")
        logger.info(f"Device: {DEVICE}")
        
        start_time = time.time()
        
        # Load processor and model
        processor = WhisperProcessor.from_pretrained(
            MODEL_NAME,
            cache_dir=CACHE_DIR
        )
        
        model = WhisperForConditionalGeneration.from_pretrained(
            MODEL_NAME,
            cache_dir=CACHE_DIR,
            torch_dtype=torch.float16 if DEVICE == 'cuda' else torch.float32
        )
        
        model = model.to(DEVICE)
        model_loaded = True
        
        load_time = time.time() - start_time
        logger.info(f"Model loaded successfully in {load_time:.2f} seconds")
        
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        raise

def preprocess_audio(audio_path, target_sr=16000):
    """Preprocess audio file for Whisper"""
    try:
        # Load audio with librosa
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=True)
        
        # Normalize audio
        audio = librosa.util.normalize(audio)
        
        return audio, sr
        
    except Exception as e:
        logger.error(f"Error preprocessing audio: {str(e)}")
        raise

def chunk_audio(audio, chunk_length_s=30, sample_rate=16000):
    """Split audio into chunks for processing"""
    chunk_length_samples = chunk_length_s * sample_rate
    chunks = []
    
    for i in range(0, len(audio), chunk_length_samples):
        chunk = audio[i:i + chunk_length_samples]
        if len(chunk) > 0:
            chunks.append(chunk)
    
    return chunks

def transcribe_audio_chunk(audio_chunk, language='no'):
    """Transcribe a single audio chunk"""
    try:
        # Prepare input
        inputs = processor(
            audio_chunk,
            sampling_rate=16000,
            return_tensors="pt"
        )
        
        # Move to device
        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
        
        # Generate transcription
        with torch.no_grad():
            generated_ids = model.generate(
                inputs["input_features"],
                language=language,
                task="transcribe",
                max_length=448,
                num_beams=5,
                temperature=0.0,
                compression_ratio_threshold=2.4,
                logprob_threshold=-1.0,
                no_speech_threshold=0.6
            )
        
        # Decode transcription
        transcription = processor.batch_decode(
            generated_ids, 
            skip_special_tokens=True
        )[0]
        
        return transcription.strip()
        
    except Exception as e:
        logger.error(f"Error transcribing chunk: {str(e)}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model_loaded,
        'model_name': MODEL_NAME,
        'device': DEVICE,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """Main transcription endpoint"""
    start_time = time.time()
    
    try:
        # Check if model is loaded
        if not model_loaded:
            load_model()
        
        # Check if audio file is provided
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No audio file selected'}), 400
        
        # Get parameters
        language = request.form.get('language', 'no')
        task = request.form.get('task', 'transcribe')
        
        logger.info(f"Transcription request: {audio_file.filename}, language: {language}")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            audio_file.save(temp_file.name)
            temp_path = temp_file.name
        
        try:
            # Preprocess audio
            audio, sr = preprocess_audio(temp_path)
            
            # Split into chunks if necessary
            if len(audio) > MAX_AUDIO_LENGTH * sr:
                chunks = chunk_audio(audio, chunk_length_s=MAX_AUDIO_LENGTH, sample_rate=sr)
                logger.info(f"Audio split into {len(chunks)} chunks")
            else:
                chunks = [audio]
            
            # Transcribe each chunk
            transcriptions = []
            for i, chunk in enumerate(chunks):
                logger.info(f"Transcribing chunk {i+1}/{len(chunks)}")
                transcription = transcribe_audio_chunk(chunk, language)
                if transcription:
                    transcriptions.append(transcription)
            
            # Combine transcriptions
            full_transcription = ' '.join(transcriptions)
            
            # Clean up memory
            gc.collect()
            if DEVICE == 'cuda':
                torch.cuda.empty_cache()
            
            processing_time = time.time() - start_time
            logger.info(f"Transcription completed in {processing_time:.2f} seconds")
            
            return jsonify({
                'transcription': full_transcription,
                'language': language,
                'chunks': len(chunks),
                'processing_time': processing_time,
                'timestamp': datetime.now().isoformat()
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        
    except Exception as e:
        logger.error(f"Transcription error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    return jsonify({
        'model_name': MODEL_NAME,
        'model_loaded': model_loaded,
        'device': DEVICE,
        'max_audio_length': MAX_AUDIO_LENGTH,
        'supported_languages': ['no', 'en', 'sv', 'da', 'de', 'fr', 'es'],
        'cache_dir': CACHE_DIR
    })

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large'}), 413

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Load model on startup
    try:
        load_model()
    except Exception as e:
        logger.error(f"Failed to load model on startup: {str(e)}")
    
    # Run the app
    app.run(host='0.0.0.0', port=8001, debug=False) 