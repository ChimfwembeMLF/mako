FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for audio processing (ffmpeg for pydub)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install dependencies.
# Note: In a production Dokploy environment with GPU, you would want a specific PyTorch CUDA wheel.
# For CPU or generic compatibility, this installs the standard pip package.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download the model so it doesn't happen on first request
# We can do this by running a simple python script during build
RUN python -c "\
from parler_tts import ParlerTTSForConditionalGeneration;\
from transformers import AutoTokenizer;\
print('Downloading model weights...');\
ParlerTTSForConditionalGeneration.from_pretrained('parler-tts/parler-tts-mini-v1');\
AutoTokenizer.from_pretrained('parler-tts/parler-tts-mini-v1');\
print('Done!')"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
