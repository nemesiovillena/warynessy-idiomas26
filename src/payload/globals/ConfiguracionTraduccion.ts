import type { GlobalConfig } from 'payload'

export const ConfiguracionTraduccion: GlobalConfig = {
    slug: 'configuracion-traduccion',
    label: 'Configuración de Traducción',
    access: {
        read: () => true,
    },
    fields: [
        {
            name: 'proveedorIA',
            type: 'select',
            label: 'Proveedor de Traducción',
            defaultValue: 'gemini-api',
            options: [
                { label: 'Google Gemini API (Directo) — Recomendado para producción', value: 'gemini-api' },
                { label: 'Agente Python (OpenRouter) — Solo para desarrollo local', value: 'agente-python' },
            ],
            admin: {
                description: 'Gemini API usa GOOGLE_API_KEY del servidor. Agente Python requiere el servicio FastAPI corriendo en el endpoint configurado.',
            },
        },
        {
            name: 'modeloIA',
            type: 'select',
            label: 'Modelo de Traducción',
            defaultValue: 'gemini-2.0-flash',
            options: [
                // Modelos Gemini API directa
                { label: 'Gemini 2.0 Flash (Rápido, Recomendado)', value: 'gemini-2.0-flash' },
                { label: 'Gemini 2.5 Pro (Máxima calidad)', value: 'gemini-2.5-pro-exp-03-25' },
                { label: 'Gemini 1.5 Flash (Económico)', value: 'gemini-1.5-flash' },
                { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
                // Modelos OpenRouter (agente Python)
                { label: 'GPT-4o (OpenRouter)', value: 'openai/gpt-4o' },
                { label: 'Claude 3.5 Sonnet (OpenRouter)', value: 'anthropic/claude-3.5-sonnet' },
                { label: 'DeepSeek V3 (OpenRouter)', value: 'deepseek/deepseek-chat' },
                { label: 'Gemini 2.0 Flash (OpenRouter)', value: 'google/gemini-2.0-flash-001' },
            ],
            admin: {
                description: 'Los modelos Gemini son para el proveedor "Google Gemini API". Los modelos OpenRouter son para el "Agente Python".',
            },
        },
        {
            name: 'endpointAgente',
            type: 'text',
            label: 'URL del Agente Python (solo si usas Agente Python)',
            defaultValue: 'http://localhost:8000/translate',
            admin: {
                description: 'Solo necesario si el proveedor es "Agente Python". URL donde está desplegado el servicio FastAPI.',
                condition: (data) => data?.proveedorIA === 'agente-python',
            },
        },
    ],
}
