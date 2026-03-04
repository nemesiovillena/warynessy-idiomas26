/**
 * Utilidades para la traducción automática en Payload CMS
 */

export interface TranslationResponse {
    translated_text: string;
}

/**
 * Llama al agente de traducción Python
 */
export async function callTranslationAgent(
    text: string,
    targetLang: string,
    endpoint: string,
    model?: string
): Promise<string> {
    try {
        console.log(`[Translation] Solicitando traducción a '${targetLang}'...`);
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                target_lang: targetLang,
                model: model || 'google/gemini-2.0-flash-001'
            })
        });

        if (res.ok) {
            const data: TranslationResponse = await res.json();
            console.log(`[Translation] Éxito: traducción a '${targetLang}' recibida.`);
            return data.translated_text;
        } else {
            console.error(`[Translation] Error del agente para '${targetLang}' (${res.status}):`, await res.text());
            return text; // Fallback al original
        }
    } catch (error) {
        console.error(`[Translation] Error de red hacia '${targetLang}':`, error);
        return text; // Fallback al original
    }
}

/**
 * Traduce recursivamente un objeto Lexical (RichText)
 */
export async function translateLexical(
    lexicalObj: any,
    targetLang: string,
    endpoint: string,
    model?: string
): Promise<any> {
    if (!lexicalObj || typeof lexicalObj !== 'object') return lexicalObj;

    // Clonar para no modificar el original durante el proceso
    const newObj = JSON.parse(JSON.stringify(lexicalObj));

    const traverseNodes = async (nodes: any[]) => {
        await Promise.all(nodes.map(async (node) => {
            if (node.text && typeof node.text === 'string' && node.text.trim().length > 0) {
                node.text = await callTranslationAgent(node.text, targetLang, endpoint, model);
            }
            if (node.children && Array.isArray(node.children)) {
                await traverseNodes(node.children);
            }
        }));
    };

    if (newObj.root && Array.isArray(newObj.root.children)) {
        await traverseNodes(newObj.root.children);
    }

    return newObj;
}
