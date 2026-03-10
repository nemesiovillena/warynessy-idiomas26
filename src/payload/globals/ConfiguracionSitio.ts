import type { GlobalConfig } from 'payload'
import { callTranslationAgent } from '../utils/translation-utils'

export const ConfiguracionSitio: GlobalConfig = {
  slug: 'configuracion-sitio',
  label: 'Configuración del Sitio',
  access: {
    read: () => true, // Public read access
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const locale = (req as any).locale;

        // PROTECCIÓN CRÍTICA: Solo traducir si estamos editando explícitamente en español
        if (locale && locale !== 'es') {
          return;
        }

        const payload = req.payload;

        // Función asíncrona para ejecutar en segundo plano
        const executeTranslations = async () => {
          // Esperar un momento aleatorio para evitar colisiones
          const randomDelay = Math.floor(Math.random() * 2000);
          await new Promise(resolve => setTimeout(resolve, 1000 + randomDelay));

          try {
            const configTraduccion: any = await payload.findGlobal({ slug: 'configuracion-traduccion' as any });
            const endpoint = configTraduccion?.endpointAgente || 'http://localhost:8000/translate';
            const modelo = configTraduccion?.modeloIA || 'gemini-2.0-flash';
              const proveedor = configTraduccion?.proveedorIA || 'gemini-api';

            const targetLocales = ['ca', 'en', 'fr', 'de'] as const;

            const prevHours: any[] = (previousDoc as any)?.openingHours || [];
            const currHours: any[] = doc.openingHours || [];

            // Detectar filas que cambiaron en days u hours
            const changedIndexes = currHours.reduce<number[]>((acc, row, i) => {
              const prev = prevHours[i];
              if (!prev || row.days !== prev.days || row.hours !== prev.hours) acc.push(i);
              return acc;
            }, []);

            if (changedIndexes.length === 0) return;

            console.log(`[CONFIG-SITIO] [Background] Iniciando traducción de ${changedIndexes.length} filas de horario...`);

            // Procesar locales secuencialmente para estabilidad, pero en background
            for (const locale of targetLocales) {
              const translatedHours = currHours.map((row: any) => ({ ...row }));

              for (const i of changedIndexes) {
                const row = currHours[i];
                if (row.days?.trim()) {
                  console.log(`[CONFIG-SITIO] [Background] Traduciendo horario (días) a ${locale}...`);
                  translatedHours[i].days = await callTranslationAgent(row.days, locale, endpoint, modelo);
                }
                if (row.hours?.trim()) {
                  console.log(`[CONFIG-SITIO] [Background] Traduciendo horario (horas) a ${locale}...`);
                  translatedHours[i].hours = await callTranslationAgent(row.hours, locale, endpoint, modelo);
                }
              }

              await payload.updateGlobal({
                slug: 'configuracion-sitio',
                locale: locale as any,
                data: { openingHours: translatedHours },
                req: { payload: req.payload, disableHooks: true } as any,
              });
            }

            console.log(`[CONFIG-SITIO] [Background] Horarios traducidos con éxito.`);
          } catch (error) {
            console.error(`[CONFIG-SITIO] [Background] Error en el proceso de traducción:`, error);
          }
        };

        // Lanzar en segundo plano sin esperar (await)
        executeTranslations();
      }

    ]
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Nombre del Restaurante',
      required: true,
      admin: {
        description: 'Nombre oficial del restaurante',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      label: 'Logo del Restaurante',
      relationTo: 'archivos',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descripción del Restaurante',
      maxLength: 160,
      admin: {
        description: 'Descripción breve para SEO y redes sociales',
      },
    },

    // Información de Contacto
    {
      name: 'contact',
      type: 'group',
      label: 'Información de Contacto',
      fields: [
        {
          name: 'phone',
          type: 'text',
          label: 'Teléfono fijo / contacto principal',
        },
        {
          name: 'whatsapp',
          type: 'text',
          label: 'WhatsApp (Móvil)',
          admin: {
            description: 'Número para recibir reservas por WhatsApp (ej: +34600000000)',
          },
        },
        {
          name: 'whatsappMessage',
          type: 'text',
          label: 'Mensaje predeterminado de WhatsApp',
          admin: {
            description: 'Mensaje que aparecerá al abrir el chat (ej: "Hola, me gustaría reservar una mesa...")',
          },
        },
        {
          name: 'email',
          type: 'email',
          label: 'Email',
        },
        {
          name: 'address',
          type: 'textarea',
          label: 'Dirección Completa',
        },
        {
          name: 'postalCode',
          type: 'text',
          label: 'Código Postal',
        },
        {
          name: 'city',
          type: 'text',
          label: 'Ciudad',
        },
        {
          name: 'province',
          type: 'text',
          label: 'Provincia',
        },
        {
          name: 'country',
          type: 'text',
          label: 'País',
        },
        {
          name: 'googleMapsUrl',
          type: 'text',
          label: 'URL de Google Maps',
        },
        {
          name: 'coordinates',
          type: 'group',
          label: 'Coordenadas GPS',
          fields: [
            {
              name: 'lat',
              type: 'number',
              label: 'Latitud',
            },
            {
              name: 'lng',
              type: 'number',
              label: 'Longitud',
            },
          ],
        },
      ],
    },

    // Horarios
    {
      name: 'openingHours',
      type: 'array',
      label: 'Horarios de Apertura',
      fields: [
        {
          name: 'days',
          type: 'text',
          label: 'Días',
          localized: true,
          admin: {
            description: 'Ej: "Lunes a Viernes", "Sábados", etc.',
          },
        },
        {
          name: 'hours',
          type: 'text',
          label: 'Horario',
          localized: true,
          admin: {
            description: 'Ej: "13:00 - 16:00 y 20:00 - 23:00"',
          },
        },
        {
          name: 'closed',
          type: 'checkbox',
          label: '¿Cerrado?',
          defaultValue: false,
        },
      ],
      admin: {
        description: 'Horarios de apertura del restaurante',
      },
    },

    // Redes Sociales
    {
      name: 'socialMedia',
      type: 'group',
      label: 'Redes Sociales',
      fields: [
        {
          name: 'facebook',
          type: 'text',
          label: 'Facebook URL',
        },
        {
          name: 'instagram',
          type: 'text',
          label: 'Instagram URL',
        },
        {
          name: 'twitter',
          type: 'text',
          label: 'Twitter/X URL',
        },
        {
          name: 'tiktok',
          type: 'text',
          label: 'TikTok URL',
        },
        {
          name: 'youtube',
          type: 'text',
          label: 'YouTube URL',
        },
        {
          name: 'tripadvisor',
          type: 'text',
          label: 'TripAdvisor URL',
        },
      ],
    },

    // Logos del Footer
    {
      name: 'footerLogos',
      type: 'array',
      label: 'Logos del Footer (Certificaciones)',
      fields: [
        {
          name: 'logo',
          type: 'upload',
          label: 'Logo',
          relationTo: 'archivos',
          required: true,
        },
        {
          name: 'alt',
          type: 'text',
          label: 'Texto alternativo',
          required: true,
        },
        {
          name: 'link',
          type: 'text',
          label: 'Enlace (opcional)',
        },
      ],
      admin: {
        description: 'Logos de certificaciones como Sicted, etc.',
      },
    },

    // Copyright y textos legales
    {
      name: 'copyright',
      type: 'text',
      label: 'Texto de Copyright',
      admin: {
        description: 'Ej: © 2026 Restaurante Warynessy. Todos los derechos reservados.',
      },
    },

    // CoverManager ID
    {
      name: 'coverManagerId',
      type: 'text',
      label: 'ID de CoverManager',
      admin: {
        description: 'ID para el widget de reservas',
      },
    },

    // Configuración de Instagram
    {
      name: 'instagramConfig',
      type: 'group',
      label: 'Configuración de Instagram',
      fields: [
        {
          name: 'method',
          type: 'radio',
          label: 'Método de visualización',
          options: [
            { label: 'API Oficial (Cuadrícula nativa)', value: 'api' },
            { label: 'Widget Externo (Embed)', value: 'widget' },
          ],
          defaultValue: 'api',
          admin: {
            layout: 'horizontal',
          },
        },
        {
          name: 'apiToken',
          type: 'text',
          label: 'Instagram Access Token',
          admin: {
            condition: (data, siblingData) => siblingData?.method === 'api',
            description: 'Token de acceso de larga duración para la API de Instagram',
          },
        },
        {
          name: 'apiUserId',
          type: 'text',
          label: 'Instagram User ID',
          admin: {
            condition: (data, siblingData) => siblingData?.method === 'api',
            description: 'ID de usuario numérico de Instagram',
          },
        },
        {
          name: 'embedCode',
          type: 'textarea',
          label: 'Código de Embed (Widget)',
          admin: {
            condition: (data, siblingData) => siblingData?.method === 'widget',
            description: 'Pega aquí el código HTML proporcionado por el servicio de widget (Behold, Elfsight, etc.)',
          },
        },
      ],
    },
  ],
}