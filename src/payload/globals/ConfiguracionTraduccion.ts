import type { GlobalConfig } from 'payload'

export const ConfiguracionTraduccion: GlobalConfig = {
    slug: 'configuracion-traduccion',
    label: 'Configuración de Traducción',
    access: {
        read: () => true,
    },
    fields: [
        {
            name: 'modeloIA',
            type: 'select',
            label: 'Modelo de Traducción (OpenRouter)',
            required: true,
            defaultValue: 'google/gemini-2.0-flash-001',
            options: [
                { label: 'Gemini 2.0 Flash (Recomendado)', value: 'google/gemini-2.0-flash-001' },
                { label: 'GPT-4o', value: 'openai/gpt-4o' },
                { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
                { label: 'Gemini Pro 1.5', value: 'google/gemini-pro-1.5' },
                { label: 'DeepSeek V3', value: 'deepseek/deepseek-chat' },
            ],
            admin: {
                description: 'Selecciona el modelo de IA que se utilizará para generar traducciones automáticas.',
            },
        },
        {
            name: 'endpointAgente',
            type: 'text',
            label: 'URL del Agente de Traducción',
            required: true,
            defaultValue: 'http://localhost:8000/translate',
            admin: {
                description: 'URL donde está desplegado el agente Python (FastAPI).',
            },
        },
    ],
}
