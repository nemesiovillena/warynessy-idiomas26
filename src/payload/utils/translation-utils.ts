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
        if (!text || typeof text !== 'string' || text.trim().length === 0) return text;

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
        // Procesar nodos secuencialmente para evitar saturar el agente
        for (const node of nodes) {
            if (node.text && typeof node.text === 'string' && node.text.trim().length > 0) {
                node.text = await callTranslationAgent(node.text, targetLang, endpoint, model);
            }
            if (node.children && Array.isArray(node.children)) {
                await traverseNodes(node.children);
            }
        }
    };

    if (newObj.root && Array.isArray(newObj.root.children)) {
        await traverseNodes(newObj.root.children);
    }

    return newObj;
}

/**
 * Traduce recursivamente un documento o parte de él basándose en una lista de campos
 */
export async function translateDocument({
    doc,
    previousDoc,
    fields,
    targetLang,
    endpoint,
    model,
    operation
}: {
    doc: any;
    previousDoc?: any;
    fields: string[];
    targetLang: string;
    endpoint: string;
    model?: string;
    operation: 'create' | 'update';
}): Promise<{ translatedData: any; hasTranslations: boolean }> {
    const translatedData: any = {};
    let hasTranslations = false;

    console.log(`[TranslateTool] Procesando traducción para locale: ${targetLang}`);

    for (const field of fields) {
        try {
            const value = doc[field];
            if (value === undefined || value === null) continue;

            const prevValue = previousDoc?.[field];
            // Comprobación profunda para cambios (útil para arrays/objetos)
            const isChanged = operation === 'create' || JSON.stringify(value) !== JSON.stringify(prevValue);

            if (!isChanged) continue;

            // Caso 1: RichText (Lexical)
            if (typeof value === 'object' && value !== null && value.root) {
                console.log(`[TranslateTool] Traduciendo RichText: ${field} al locale ${targetLang}...`);
                translatedData[field] = await translateLexical(value, targetLang, endpoint, model);
                hasTranslations = true;
            }
            // Caso 2: Arrays
            else if (Array.isArray(value)) {
                console.log(`[TranslateTool] Traduciendo Array: ${field} (${value.length} elementos) al locale ${targetLang}...`);
                const translatedArray = [];
                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        const translatedItem = { ...item };
                        for (const subKey in item) {
                            if (typeof item[subKey] === 'string' && item[subKey].trim().length > 0) {
                                translatedItem[subKey] = await callTranslationAgent(item[subKey], targetLang, endpoint, model);
                            }
                        }
                        translatedArray.push(translatedItem);
                    } else if (typeof item === 'string' && item.trim().length > 0) {
                        translatedArray.push(await callTranslationAgent(item, targetLang, endpoint, model));
                    } else {
                        translatedArray.push(item);
                    }
                }
                translatedData[field] = translatedArray;
                hasTranslations = true;
            }
            // Caso 3: Grupos u Objetos planos
            else if (typeof value === 'object' && value !== null) {
                console.log(`[TranslateTool] Traduciendo Grupo/Objeto: ${field} al locale ${targetLang}...`);
                const translatedGroup = { ...value };
                let groupChanged = false;
                for (const subKey in value) {
                    if (typeof value[subKey] === 'string' && value[subKey].trim().length > 0) {
                        translatedGroup[subKey] = await callTranslationAgent(value[subKey], targetLang, endpoint, model);
                        groupChanged = true;
                    }
                }
                if (groupChanged) {
                    translatedData[field] = translatedGroup;
                    hasTranslations = true;
                }
            }
            // Caso 4: Strings simples
            else if (typeof value === 'string' && value.trim().length > 0) {
                console.log(`[TranslateTool] Traduciendo Texto: ${field} al locale ${targetLang}...`);
                const translated = await callTranslationAgent(value, targetLang, endpoint, model);

                if (translated) {
                    translatedData[field] = translated;
                    hasTranslations = true;
                }
            }
        } catch (fieldError) {
            console.error(`[TranslateTool] Error traduciendo campo '${field}' a '${targetLang}':`, fieldError);
            // Ignoramos este campo y seguimos con el resto
        }
    }

    return { translatedData, hasTranslations };
}
