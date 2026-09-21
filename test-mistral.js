import { Mistral } from '@mistralai/mistralai';
const m = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
async function test() {
  try {
    const res = await m.audio.speech.complete({
      model: 'voxtral-mini-tts-latest',
      input: 'Hello world',
      voiceId: 'c69964a6-ab8b-4f8a-9465-ec0925096ec8',
      responseFormat: 'mp3',
      stream: false
    });
    console.log(typeof res, Object.keys(res || {}));
    if (res && res.audioData) {
      console.log('audioData type:', typeof res.audioData);
      console.log('isUint8Array?', res.audioData instanceof Uint8Array);
      console.log('isBuffer?', Buffer.isBuffer(res.audioData));
    }
  } catch (err) {
    console.error(err);
  }
}
test();
