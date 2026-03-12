import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Re-exportar el importMap generado por Payload (requerido por page.tsx del admin)
// export { importMap } from './src/app/(payload)/admin/importMap.js'

export default buildConfig({
  admin: {
    meta: {
      titleSuffix: '- Warynessy CMS',
    },
  },
  collections: [],
  globals: [],

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: false,
  }),

  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload/payload-types.ts'),
  },

  secret: process.env.PAYLOAD_SECRET || 'development-secret-key',
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  cors: [],
  csrf: [],
  plugins: [],
})
