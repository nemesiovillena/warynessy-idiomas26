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
            defaultValue: 'agente-python',
            options: [
                { label: 'Agente Python (OpenRouter)', value: 'agente-python' },
            ],
            admin: {
                description: 'Usa agente Python (FastAPI) con OpenRouter. Requiere OPENROUTER_API_KEY en variables de entorno.',
            },
        },
        {
            name: 'modeloIA',
            type: 'select',
            label: 'Modelo de Traducción (OpenRouter)',
            defaultValue: 'anthropic/claude-3-5-haiku',
            options: [
                { label: 'Claude 3.5 Haiku (Rápido, Recomendado)', value: 'anthropic/claude-3-5-haiku' },
                { label: 'Claude 3.5 Sonnet (Máxima calidad)', value: 'anthropic/claude-3.5-sonnet' },
                { label: 'GPT-4o Mini (Económico)', value: 'openai/gpt-4o-mini' },
                { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
            ],
            admin: {
                description: 'Modelos disponibles en OpenRouter para el agente Python.',
            },
        },
        {
            name: 'endpointAgente',
            type: 'text',
            label: 'URL del Agente Python',
            defaultValue: 'http://localhost:8000/translate',
            admin: {
                description: 'URL donde está desplegado el servicio FastAPI del agente.',
            },
        },
    ],
}
