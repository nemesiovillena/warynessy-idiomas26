import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

app = FastAPI(title="Warynessy Translation Agent")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

class TranslationRequest(BaseModel):
    text: str
    target_lang: str
    model: str = "google/gemini-2.0-flash-001"

@app.get("/")
async def root():
    return {"status": "ok", "message": "Warynessy Translation Agent is running"}

@app.post("/translate")
async def translate_text(request: TranslationRequest):
    print(f"📥 Nueva petición de traducción: Idioma destino = {request.target_lang}")
    if not OPENROUTER_API_KEY:
        # En modo local, si no hay API Key, devolvemos un mock para no bloquear
        print("⚠️ OPENROUTER_API_KEY no encontrada. Devolviendo mock.")
        return {"translated_text": f"[{request.target_lang.upper()}] {request.text}"}

    prompt = f"Traduce el siguiente texto al idioma con código ISO '{request.target_lang}'. Mantén el tono original. Solo devuelve la traducción, nada más. Si es una sola palabra o frase corta, no añadidas explicaciones:\n\n{request.text}"

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://warynessy.com",
                "X-Title": "Warynessy Translation Agent",
            },
            json={
                "model": request.model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
            },
            timeout=30
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        result = response.json()
        translated_text = result['choices'][0]['message']['content'].strip()
        
        return {"translated_text": translated_text}
    except Exception as e:
        print(f"❌ Error en la traducción: {str(e)}")
        # Fallback a mock en caso de error de red o API
        return {"translated_text": f"[{request.target_lang.upper()}] {request.text}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
