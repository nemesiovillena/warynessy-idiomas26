/**
 * Cliente de traducción directo usando Google Gemini API.
 * Usado en producción cuando el agente Python no está disponible.
 * Requiere la variable de entorno GOOGLE_API_KEY.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_TIMEOUT_MS = 20_000

const LANGUAGE_NAMES: Record<string, string> = {
    ca: 'Catalan',
    en: 'English',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
}

/**
 * Traduce texto usando la API de Gemini directamente.
 * Fallback al texto original si la API falla.
 */
export async function translateWithGemini(
    text: string,
    targetLang: string,
    model: string
): Promise<string> {
    if (!text || typeof text !== 'string' || text.trim().length === 0) return text

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
        console.error('[Gemini] GOOGLE_API_KEY no configurada en variables de entorno')
        return text
    }

    const targetLanguage = LANGUAGE_NAMES[targetLang] || targetLang
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text, no explanations, no quotes, no extra formatting.\n\nText to translate:\n${text}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

    try {
        const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                },
            }),
            signal: controller.signal,
        })

        if (!res.ok) {
            console.error(`[Gemini] Error API (${res.status}):`, await res.text())
            return text
        }

        const data = await res.json()
        const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

        if (!translated) {
            console.error('[Gemini] Respuesta vacía o inesperada:', JSON.stringify(data).substring(0, 200))
            return text
        }

        console.log(`[Gemini] Traducción a '${targetLang}' completada (${model})`)
        return translated
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            console.error(`[Gemini] Timeout (${GEMINI_TIMEOUT_MS}ms) para '${targetLang}'`)
        } else {
            console.error(`[Gemini] Error de red para '${targetLang}':`, error)
        }
        return text
    } finally {
        clearTimeout(timer)
    }
}
