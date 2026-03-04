import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { bunnyStorage } from '@seshuk/payload-storage-bunny'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Load .env file
dotenv.config({
  path: path.resolve(dirname, '.env'),
})

// Colecciones
import { Alergenos } from './src/payload/collections/Alergenos'
import { Categorias } from './src/payload/collections/Categorias'
import { Platos } from './src/payload/collections/Platos'
import { MenusGrupo } from './src/payload/collections/MenusGrupo'
import { Menus } from './src/payload/collections/Menus'
import { Espacios } from './src/payload/collections/Espacios'
import { Banners } from './src/payload/collections/Banners'
import { Archivos } from './src/payload/collections/Archivos'
import { Usuarios } from './src/payload/collections/Usuarios'
import { es } from '@payloadcms/translations/languages/es'
import { en } from '@payloadcms/translations/languages/en'
import { ca } from '@payloadcms/translations/languages/ca'
import { de } from '@payloadcms/translations/languages/de'
import { fr } from '@payloadcms/translations/languages/fr'
import { Paginas } from './src/payload/collections/Paginas'
import { Experiencias } from './src/payload/collections/Experiencias'

// Globals
import { PaginaInicio } from './src/payload/globals/PaginaInicio'
import { ConfiguracionSitio } from './src/payload/globals/ConfiguracionSitio'
import { ConfiguracionTraduccion } from './src/payload/globals/ConfiguracionTraduccion'

// Plugin de backups granulares
import { backupPlugin } from './plugins/backupPlugin'

// Re-exportar el importMap generado por Payload (requerido por page.tsx del admin)
export { importMap } from './src/app/(payload)/admin/importMap.js'

export default buildConfig({
  // Configuraciรณn del panel de administraciรณn
  admin: {
    user: Usuarios.slug,
    meta: {
      titleSuffix: '- Warynessy CMS',
    },
  },

  // Internacionalización (i18n)
  localization: {
    locales: [
      { label: 'Español', code: 'es' },
      { label: 'Valencià', code: 'ca' },
      { label: 'English', code: 'en' },
      { label: 'Français', code: 'fr' },
      { label: 'Deutsch', code: 'de' },
    ],
    defaultLocale: 'es',
    fallback: true,
  },
  i18n: {
    fallbackLanguage: 'es',
    supportedLanguages: { es, en, ca, de, fr },
  },

  // Colecciones (tipos de documentos)
  collections: [
    Usuarios,
    Archivos,
    Alergenos,
    Categorias,
    Platos,
    Menus,
    Espacios,
    Banners,
    Paginas,
    Experiencias,
    MenusGrupo,
  ],

  globals: [
    PaginaInicio,
    ConfiguracionSitio,
    ConfiguracionTraduccion,
  ],

  // Configuraciรณn del editor
  editor: lexicalEditor({}),

  // Configuraciรณn de base de datos
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: true, // Auto-sync schema on startup (creates tables)
  }),

  // Optimizaciรณn de imรกgenes
  sharp,

  // Configuraciรณn de TypeScript
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload/payload-types.ts'),
  },

  // Clave secreta
  secret: process.env.PAYLOAD_SECRET || 'development-secret-key',

  // Configuraciรณn de Servidor y URLs
  // Nota: En producciรณn Next.js detecta automรกticamente la URL si no se especifica,
  // pero forzamos el uso de variables de entorno si existen.
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',

  // Configuraciรณn CORS - Permitir el propio servidor y el sitio pรบblico
  cors: [
    process.env.PAYLOAD_PUBLIC_SERVER_URL,
    process.env.PUBLIC_SITE_URL,
  ].filter(Boolean) as string[],

  // Configuraciรณn CSRF
  csrf: [
    process.env.PAYLOAD_PUBLIC_SERVER_URL,
    process.env.PUBLIC_SITE_URL,
  ].filter(Boolean) as string[],

  plugins: [
    // Solo activar Bunny Storage en producción o cuando estén configuradas las credenciales
    ...(process.env.BUNNY_STORAGE_PASSWORD && process.env.BUNNY_STORAGE_ZONE_NAME ? [
      bunnyStorage({
        collections: {
          archivos: true,
        },
        storage: {
          apiKey: process.env.BUNNY_STORAGE_PASSWORD || '',
          zoneName: process.env.BUNNY_STORAGE_ZONE_NAME || '',
          hostname: process.env.PUBLIC_BUNNY_CDN_URL || 'https://warynessy.b-cdn.net',
        },
      }),
    ] : []),
    backupPlugin({
      // Colecciones a monitorizar (excluye automáticamente las internas del plugin)
      collections: [
        'alergenos',
        'categorias',
        'platos',
        'menus',
        'menus-grupo',
        'espacios',
        'banners',
        'archivos',
        'paginas',
        'experiencias',
      ],
      // Globals a monitorizar
      globals: ['pagina-inicio', 'configuracion-sitio'],
      // Configuración del agente de background
      agent: {
        incrementalIntervalMs: 60 * 60 * 1000,   // Consolidar cada hora
        fullBackupIntervalMs: 24 * 60 * 60 * 1000, // Backup completo cada 24h
        consolidateAfterDeltas: 100,               // Consolidar tras 100 cambios
        retention: {
          maxDeltas: 500,
          maxIncrementalSnapshots: 30,
          keepWeeklySnapshots: 4,
          keepMonthlySnapshots: 12,
        },
      },
    }),
  ],
})

