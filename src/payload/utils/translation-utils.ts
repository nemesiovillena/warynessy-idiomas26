/**
 * Utilidades para la traducción automática en Payload CMS.
 * Soporta dos proveedores:
 *   - 'gemini-api': Llama directamente a Google Gemini API (requiere GOOGLE_API_KEY)
 *   - 'agente-python': Llama al servicio FastAPI (local o Dokploy via Docker network)
 */

import { translateWithGemini } from './gemini-translation-client';

export interface TranslationResponse {
    translated_text: string;
}

/**
 * Set de IDs de documentos que están siendo traducidos actualmente.
 * Los hooks afterChange deben comprobar este set para evitar ejecuciones paralelas
 * sobre el mismo documento (condición de carrera).
 */
export const translatingIds = new Set<string>();

const AGENT_TIMEOUT_MS = 15_000;

/**
 * Realiza una petición al agente Python (FastAPI) con timeout.
 */
async function fetchFromPythonAgent(
    text: string,
    targetLang: string,
    endpoint: string,
    model: string
): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, target_lang: targetLang, model }),
            signal: controller.signal,
        });

        if (res.ok) {
            const data: TranslationResponse = await res.json();
            return data.translated_text;
        }
        console.error(`[AgentePython] Error para '${targetLang}' (${res.status}):`, await res.text());
        return text;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Punto de entrada único para traducción de texto.
 * Enruta al proveedor correcto según configuración.
 */
export async function callTranslationAgent(
    text: string,
    targetLang: string,
    endpoint: string,
    model?: string,
    proveedor?: string
): Promise<string> {
    if (!text || typeof text !== 'string' || text.trim().length === 0) return text;

    const resolvedModel = model || 'gemini-2.0-flash';
    const resolvedProveedor = proveedor || 'gemini-api';

    console.log(`[Translation] Traduciendo a '${targetLang}' via '${resolvedProveedor}' (${resolvedModel})...`);

    // Proveedor: Google Gemini API directa
    if (resolvedProveedor === 'gemini-api') {
        return translateWithGemini(text, targetLang, resolvedModel);
    }

    // Proveedor: Agente Python (con reintento en fallos de red)
    try {
        const result = await fetchFromPythonAgent(text, targetLang, endpoint, resolvedModel);
        console.log(`[Translation] Éxito via agente Python para '${targetLang}'.`);
        return result;
    } catch (firstError) {
        console.warn(`[Translation] Primer intento fallido, reintentando...`, firstError);
        try {
            return await fetchFromPythonAgent(text, targetLang, endpoint, resolvedModel);
        } catch (retryError) {
            console.error(`[Translation] Error tras reintento para '${targetLang}':`, retryError);
            return text;
        }
    }
}

/**
 * Traduce recursivamente un objeto Lexical (RichText)
 */
export async function translateLexical(
    lexicalObj: any,
    targetLang: string,
    endpoint: string,
    model?: string,
    proveedor?: string
): Promise<any> {
    if (!lexicalObj || typeof lexicalObj !== 'object') return lexicalObj;

    // Clonar para no modificar el original durante el proceso
    const newObj = JSON.parse(JSON.stringify(lexicalObj));

    const traverseNodes = async (nodes: any[]) => {
        // Procesar nodos secuencialmente para evitar saturar el agente
        for (const node of nodes) {
            if (node.text && typeof node.text === 'string' && node.text.trim().length > 0) {
                node.text = await callTranslationAgent(node.text, targetLang, endpoint, model, proveedor);
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
    proveedor,
    operation
}: {
    doc: any;
    previousDoc?: any;
    fields: string[];
    targetLang: string;
    endpoint: string;
    model?: string;
    proveedor?: string;
    operation: 'create' | 'update';
}): Promise<{ translatedData: any; hasTranslations: boolean }> {
    const translatedData: any = {};
    let hasTranslations = false;

    // Función auxiliar para extraer el ID si es un objeto de Payload
    const extractId = (val: any) => {
        if (typeof val === 'object' && val !== null && val.id !== undefined) {
            return val.id;
        }
        return val;
    };

    console.log(`[TranslateTool] Procesando traducción para locale: ${targetLang}`);
    // console.log(`[TranslateTool] DEBUG: doc keys = ${Object.keys(doc).join(', ')}`);

    for (const field of fields) {
        try {
            const value = doc[field];
            if (value === undefined || value === null) continue;

            const prevValue = previousDoc?.[field];
            // Comprobación profunda para cambios
            // Siempre traducimos si es una creación. 
            // Si es una actualización, traducimos si el valor ha cambiado.
            const isChanged = operation === 'create' ||
                !prevValue ||
                JSON.stringify(value) !== JSON.stringify(prevValue);

            // [NUEVO] Si el valor es el mismo pero sospechamos que no está traducido (fuerza bruta), podemos forzarlo
            // Por ahora, si es una actualización manual, permitimos que se fuerce si el usuario vuelve a guardar
            if (!isChanged) {
                console.log(`[TranslateTool] Campo '${field}' no ha cambiado, pero procedemos para asegurar traducción en ${targetLang}.`);
            }

            // Caso 1: RichText (Lexical)
            if (typeof value === 'object' && value !== null && value.root) {
                console.log(`[TranslateTool] Traduciendo RichText: ${field} al locale ${targetLang}...`);
                translatedData[field] = await translateLexical(value, targetLang, endpoint, model, proveedor);
                hasTranslations = true;
            }
            // Caso 2: Arrays
            else if (Array.isArray(value)) {
                console.log(`[TranslateTool] Traduciendo Array: ${field} (${value.length} elementos) al locale ${targetLang}...`);
                const translatedArray = [];
                const KEYS_TO_SKIP = ['id', 'imagen', 'archivo', 'file', 'url', 'filename', 'mimeType', 'filesize', 'width', 'height', 'createdAt', 'updatedAt'];

                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        const translatedItem: any = {};
                        for (const subKey in item) {
                            // SIEMPRE saltamos el 'id' dentro de arrays para que Payload genere nuevos para el nuevo locale
                            if (subKey === 'id') continue;

                            if (KEYS_TO_SKIP.includes(subKey)) {
                                translatedItem[subKey] = extractId(item[subKey]);
                                continue;
                            }

                            if (typeof item[subKey] === 'string' && item[subKey].trim().length > 0) {
                                // Omitir si parece un ID (24 hex) o una UUID
                                if (/^[0-9a-fA-F]{24}$/.test(item[subKey]) || /^[0-9a-fA-F-]{36}$/.test(item[subKey])) {
                                    translatedItem[subKey] = item[subKey];
                                    continue;
                                }

                                translatedItem[subKey] = await callTranslationAgent(item[subKey], targetLang, endpoint, model, proveedor);
                            } else {
                                translatedItem[subKey] = extractId(item[subKey]);
                            }
                        }
                        translatedArray.push(translatedItem);
                    } else if (typeof item === 'string' && item.trim().length > 0) {
                        // Omitir si parece un ID
                        if (/^[0-9a-fA-F]{24}$/.test(item) || /^[0-9a-fA-F-]{36}$/.test(item)) {
                            translatedArray.push(item);
                            continue;
                        }
                        translatedArray.push(await callTranslationAgent(item, targetLang, endpoint, model, proveedor));
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
                const KEYS_TO_SKIP = ['id', 'imagen', 'archivo', 'file', 'url', 'filename', 'mimeType', 'filesize', 'width', 'height', 'createdAt', 'updatedAt'];

                for (const subKey in value) {
                    if (subKey === 'id') continue;
                    if (KEYS_TO_SKIP.includes(subKey)) {
                        translatedGroup[subKey] = extractId(value[subKey]);
                        continue;
                    }
                    if (typeof value[subKey] === 'string' && value[subKey].trim().length > 0) {
                        // Omitir si parece un ID
                        if (/^[0-9a-fA-F]{24}$/.test(value[subKey]) || /^[0-9a-fA-F-]{36}$/.test(value[subKey])) {
                            translatedGroup[subKey] = value[subKey];
                            continue;
                        }

                        translatedGroup[subKey] = await callTranslationAgent(value[subKey], targetLang, endpoint, model, proveedor);
                        groupChanged = true;
                    } else {
                        translatedGroup[subKey] = extractId(value[subKey]);
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
                const translated = await callTranslationAgent(value, targetLang, endpoint, model, proveedor);

                if (translated) {
                    translatedData[field] = translated;
                    hasTranslations = true;
                }
            }
            // Caso 5: Otros (Numbers, Booleans, IDs) - Preservar
            else {
                translatedData[field] = extractId(value);
            }
        } catch (fieldError) {
            console.error(`[TranslateTool] Error traduciendo campo '${field}' a '${targetLang}':`, fieldError);
            // Ignoramos este campo y seguimos con el resto
        }
    }

    return { translatedData, hasTranslations };
}
