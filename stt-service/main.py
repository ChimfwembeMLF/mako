import os
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException
import whisper

app = FastAPI(title="Mako Whisper STT Service")

# Global model variables
device = "cuda" if torch.cuda.is_available() else "cpu"
model = None

@app.on_event("startup")
def load_model():
    global model
    print(f"Loading Whisper model (tiny) on {device}...")
    # Load the 'tiny' model. We can change this to 'base' or 'small' if better accuracy is needed.
    model = whisper.load_model("tiny", device=device)
    print("Whisper model loaded successfully.")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=503, detail="Model is currently loading or failed to load")
    
    try:
        # Read the file bytes
        audio_bytes = await file.read()
        
        # Whisper requires audio to be a file on disk to parse via ffmpeg
        temp_file_path = f"/tmp/{file.filename}"
        with open(temp_file_path, "wb") as f:
            f.write(audio_bytes)
            
        # Run transcription
        result = model.transcribe(temp_file_path)
        
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        return {"text": result.get("text", "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
