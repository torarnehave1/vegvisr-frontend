from typing import Dict, List, Any
import io
import base64
import torch
import torchaudio
from pyannote.audio import Pipeline


class EndpointHandler:
    def __init__(self, path=""):
        # Load the diarization pipeline
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=True  # pyannote.audio 3.x uses use_auth_token
        )
        
        # Use GPU if available
        if torch.cuda.is_available():
            self.pipeline.to(torch.device("cuda"))

    def __call__(self, data: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Process audio for speaker diarization.
        
        Args:
            data: Dictionary with "inputs" key containing base64-encoded audio
            
        Returns:
            Dictionary with "segments" key containing list of speaker segments
        """
        # Get the base64-encoded audio from inputs
        inputs = data.get("inputs", "")
        
        if not inputs:
            return {"error": "No audio data provided in 'inputs' field"}
        
        try:
            # Decode base64 to bytes
            audio_bytes = base64.b64decode(inputs)
            
            # Convert bytes to audio array using torchaudio (supports more formats)
            audio_buffer = io.BytesIO(audio_bytes)
            waveform, sample_rate = torchaudio.load(audio_buffer)
            
            # Create audio dict for pyannote
            audio_dict = {
                "waveform": waveform,
                "sample_rate": sample_rate
            }
            
            # Run diarization
            diarization = self.pipeline(audio_dict)
            
            # Convert to clean JSON format with "segments" key
            segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                segments.append({
                    "speaker": speaker,
                    "start": round(turn.start, 2),
                    "end": round(turn.end, 2)
                })
            
            # Always return dictionary with "segments" key containing list
            return {
                "segments": segments
            }
            
        except base64.binascii.Error as e:
            return {"error": f"Invalid base64 encoding: {str(e)}"}
        except Exception as e:
            return {"error": f"Processing error: {str(e)}"}
