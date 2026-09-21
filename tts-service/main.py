from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse
import torch
import io
import scipy.io.wavfile
import numpy as np
from pydub import AudioSegment
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer

app = FastAPI(title="Mako Parler-TTS Service")

# Global model variables
device = "cuda:0" if torch.cuda.is_available() else "cpu"
model = None
tokenizer = None

@app.on_event("startup")
def load_model():
    global model, tokenizer
    print(f"Loading Parler-TTS model on {device}...")
    model = ParlerTTSForConditionalGeneration.from_pretrained("parler-tts/parler-tts-mini-v1").to(device)
    tokenizer = AutoTokenizer.from_pretrained("parler-tts/parler-tts-mini-v1")
    print("Model loaded successfully.")

def wav_to_mp3(audio_arr, sample_rate):
    """Convert numpy array audio to an MP3 byte stream using pydub"""
    # Audio is typically float32 between -1 and 1
    # Convert to int16
    audio_int16 = np.int16(audio_arr * 32767)
    
    # Save as WAV in memory
    wav_io = io.BytesIO()
    scipy.io.wavfile.write(wav_io, sample_rate, audio_int16)
    wav_io.seek(0)
    
    # Convert to MP3
    audio_segment = AudioSegment.from_wav(wav_io)
    mp3_io = io.BytesIO()
    audio_segment.export(mp3_io, format="mp3", bitrate="192k")
    mp3_io.seek(0)
    return mp3_io

@app.post("/generate")
async def generate_speech(
    text: str = Body(..., embed=True),
    description: str = Body("A friendly male speaker with a clear voice.", embed=True)
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
        
    try:
        input_ids = tokenizer(description, return_tensors="pt").input_ids.to(device)
        prompt_input_ids = tokenizer(text, return_tensors="pt").input_ids.to(device)

        # Generate audio using Parler-TTS
        generation = model.generate(input_ids=input_ids, prompt_input_ids=prompt_input_ids)
        audio_arr = generation.cpu().numpy().squeeze()
        
        # Parler-TTS sample rate is typically found in model.config
        sample_rate = model.config.sampling_rate

        # Convert to MP3 stream
        mp3_io = wav_to_mp3(audio_arr, sample_rate)
        
        return StreamingResponse(mp3_io, media_type="audio/mpeg")
    except Exception as e:
        print("TTS Generation Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "device": device}
